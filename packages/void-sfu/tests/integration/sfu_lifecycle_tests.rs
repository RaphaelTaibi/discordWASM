// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! Integration tests covering the public lifecycle surface of [`Sfu`]:
//! construction, peer registration, room join/leave bookkeeping and the
//! observer fan-out. Network-bound paths (offer/answer/ICE) are covered in
//! their own dedicated suites since they require a live PeerConnection
//! pair.

use std::sync::Arc;

use async_trait::async_trait;
use parking_lot::Mutex;
use tokio::sync::mpsc;
use void_sfu::{
    Outbound, PeerId, RoomEvent, RoomId, RoomObserver, Sfu, SfuConfig, SfuError, SfuResult,
    SignalSink,
};

/// Minimal [`SignalSink`] used by the lifecycle tests. It records every
/// outbound message into an unbounded channel so the test body can assert
/// on what the SFU asked the host to deliver. The lifecycle suite never
/// triggers SDP/ICE messages, so the recorder typically stays empty.
struct RecordingSink {
    tx: mpsc::UnboundedSender<(PeerId, Outbound)>,
}

impl RecordingSink {
    fn new() -> (Arc<Self>, mpsc::UnboundedReceiver<(PeerId, Outbound)>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Arc::new(Self { tx }), rx)
    }
}

#[async_trait]
impl SignalSink for RecordingSink {
    async fn deliver(&self, peer: &PeerId, message: Outbound) -> SfuResult<()> {
        // Best-effort: a closed channel just means the test has already
        // finished and dropped the receiver. Treat it as a non-fatal drop.
        let _ = self.tx.send((peer.clone(), message));
        Ok(())
    }
}

/// Observer that snapshots every [`RoomEvent`] in arrival order. Cheap to
/// clone (Arc) so the test can keep one handle while installing another
/// into the SFU.
#[derive(Default)]
struct CollectingObserver {
    events: Mutex<Vec<RoomEvent>>,
}

impl CollectingObserver {
    fn snapshot(&self) -> Vec<RoomEvent> {
        self.events.lock().clone()
    }
}

#[async_trait]
impl RoomObserver for CollectingObserver {
    async fn on_event(&self, event: RoomEvent) {
        self.events.lock().push(event);
    }
}

/// Builds an SFU with a default config for tests that do not need a custom
/// media engine. Panics inside the test runner are acceptable: a failure
/// here means the public constructor itself is broken.
fn fresh_sfu() -> Sfu {
    Sfu::new(SfuConfig::default()).expect("Sfu::new must succeed with default config")
}

#[tokio::test]
async fn new_yields_empty_sfu() {
    let sfu = fresh_sfu();
    assert_eq!(sfu.peer_count(), 0);
    assert_eq!(sfu.room_count(), 0);
}

#[tokio::test]
async fn add_peer_is_idempotent_only_via_remove() {
    let sfu = fresh_sfu();
    let (sink, _rx) = RecordingSink::new();
    let alice = PeerId::from("alice");

    sfu.add_peer(alice.clone(), sink.clone())
        .expect("first add must succeed");
    assert_eq!(sfu.peer_count(), 1);

    let _err = sfu
        .add_peer(alice.clone(), sink.clone())
        .expect_err("re-adding the same peer id must fail");
    assert!(matches!(_err, SfuError::PeerAlreadyExists(_)));

    sfu.remove_peer(&alice).await.expect("remove must succeed");
    assert_eq!(sfu.peer_count(), 0);

    sfu.add_peer(alice, sink)
        .expect("re-adding after removal must succeed");
    assert_eq!(sfu.peer_count(), 1);
}

#[tokio::test]
async fn remove_unknown_peer_returns_not_found() {
    let sfu = fresh_sfu();
    let ghost = PeerId::from("ghost");
    let _err = sfu
        .remove_peer(&ghost)
        .await
        .expect_err("removing a peer that was never added must fail");
    assert!(matches!(_err, SfuError::PeerNotFound(_)));
}

#[tokio::test]
async fn join_room_returns_existing_members_snapshot() {
    let sfu = fresh_sfu();
    let (sink, _rx) = RecordingSink::new();
    let alice = PeerId::from("alice");
    let bob = PeerId::from("bob");
    let room = RoomId::from("room-1");

    sfu.add_peer(alice.clone(), sink.clone()).unwrap();
    sfu.add_peer(bob.clone(), sink).unwrap();

    let _alice_snap = sfu.join_room(&alice, room.clone()).await.unwrap();
    assert!(
        _alice_snap.existing_peers.is_empty(),
        "first joiner sees nobody"
    );
    assert_eq!(_alice_snap.room_id.as_str(), "room-1");

    let _bob_snap = sfu.join_room(&bob, room.clone()).await.unwrap();
    assert_eq!(_bob_snap.existing_peers.len(), 1);
    assert_eq!(_bob_snap.existing_peers[0].peer_id, alice);

    // Both peers must be reflected in the room snapshot helpers.
    let mut members = sfu.room_members(&room);
    members.sort_by(|a, b| a.as_str().cmp(b.as_str()));
    assert_eq!(members, vec![alice.clone(), bob.clone()]);
    assert_eq!(sfu.peer_room(&alice).as_ref(), Some(&room));
    assert_eq!(sfu.peer_room(&bob).as_ref(), Some(&room));
    assert_eq!(sfu.room_count(), 1);
}

#[tokio::test]
async fn leave_room_clears_membership_and_garbage_collects() {
    let sfu = fresh_sfu();
    let (sink, _rx) = RecordingSink::new();
    let alice = PeerId::from("alice");
    let room = RoomId::from("room-1");

    sfu.add_peer(alice.clone(), sink).unwrap();
    sfu.join_room(&alice, room.clone()).await.unwrap();
    assert_eq!(sfu.room_count(), 1);

    sfu.leave_room(&alice).await.unwrap();
    assert!(sfu.peer_room(&alice).is_none());
    assert!(sfu.room_members(&room).is_empty());
    assert_eq!(sfu.room_count(), 0, "empty rooms must be reaped");

    // leave_room is idempotent: calling it again on a peer with no room
    // must succeed without error.
    sfu.leave_room(&alice)
        .await
        .expect("idempotent leave must succeed");
}

#[tokio::test]
async fn switching_rooms_detaches_from_previous_one() {
    let sfu = fresh_sfu();
    let (sink, _rx) = RecordingSink::new();
    let alice = PeerId::from("alice");
    let room_a = RoomId::from("room-a");
    let room_b = RoomId::from("room-b");

    sfu.add_peer(alice.clone(), sink).unwrap();
    sfu.join_room(&alice, room_a.clone()).await.unwrap();
    sfu.join_room(&alice, room_b.clone()).await.unwrap();

    assert_eq!(sfu.peer_room(&alice).as_ref(), Some(&room_b));
    assert!(sfu.room_members(&room_a).is_empty());
    assert_eq!(sfu.room_members(&room_b).len(), 1);
}

#[tokio::test]
async fn remove_peer_propagates_left_event_when_in_room() {
    let sfu = fresh_sfu();
    let (sink, _rx) = RecordingSink::new();
    let observer = Arc::new(CollectingObserver::default());
    sfu.set_observer(observer.clone());

    let alice = PeerId::from("alice");
    let room = RoomId::from("room-1");
    sfu.add_peer(alice.clone(), sink).unwrap();
    sfu.join_room(&alice, room.clone()).await.unwrap();
    sfu.remove_peer(&alice).await.unwrap();

    let _events = observer.snapshot();
    assert!(_events.iter().any(|e| matches!(
        e,
        RoomEvent::PeerJoined { room: r, peer: p } if r == &room && p == &alice
    )));
    assert!(_events.iter().any(|e| matches!(
        e,
        RoomEvent::PeerLeft { room: r, peer: p } if r == &room && p == &alice
    )));
}

#[tokio::test]
async fn join_room_for_unknown_peer_returns_not_found() {
    let sfu = fresh_sfu();
    let _err = sfu
        .join_room(&PeerId::from("ghost"), RoomId::from("room"))
        .await
        .expect_err("join must fail when the peer is not registered");
    assert!(matches!(_err, SfuError::PeerNotFound(_)));
}

#[tokio::test]
async fn room_members_for_unknown_room_is_empty() {
    let sfu = fresh_sfu();
    assert!(sfu.room_members(&RoomId::from("nope")).is_empty());
}

#[tokio::test]
async fn peer_room_for_unknown_peer_is_none() {
    let sfu = fresh_sfu();
    assert!(sfu.peer_room(&PeerId::from("ghost")).is_none());
}
