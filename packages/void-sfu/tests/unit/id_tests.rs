// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! Tests covering the `Arc<str>`-backed identifier newtypes.

use std::collections::HashSet;

use void_sfu::{DataChannelSourceId, MediaSourceId, PeerId, RoomId};

#[test]
fn peer_id_equality_is_content_based() {
    let _a = PeerId::from("alice");
    let _b = PeerId::from(String::from("alice"));
    assert_eq!(_a, _b);
    let mut set: HashSet<PeerId> = HashSet::new();
    set.insert(_a);
    assert!(set.contains(&_b));
}

#[test]
fn room_id_display_and_as_str_match_input() {
    let r = RoomId::from("room-1");
    assert_eq!(r.as_str(), "room-1");
    assert_eq!(format!("{}", r), "room-1");
}

#[test]
fn media_source_id_is_deterministic() {
    let peer = PeerId::from("alice");
    let a = MediaSourceId::from_peer_and_track(&peer, "track-7");
    let b = MediaSourceId::from_peer_and_track(&peer, "track-7");
    assert_eq!(a, b);
    assert_eq!(a.as_str(), "alice:track-7");
}

#[test]
fn media_source_id_separates_publishers() {
    let p1 = PeerId::from("alice");
    let p2 = PeerId::from("bob");
    let a = MediaSourceId::from_peer_and_track(&p1, "track-1");
    let b = MediaSourceId::from_peer_and_track(&p2, "track-1");
    assert_ne!(a, b);
}

#[test]
fn data_channel_source_id_includes_dc_marker() {
    let peer = PeerId::from("alice");
    let id = DataChannelSourceId::from_peer_and_label(&peer, "events");
    assert_eq!(id.as_str(), "alice:dc:events");
}

#[test]
fn media_and_dc_ids_do_not_collide_in_string_form() {
    // The two newtypes live in different DashMaps, so a clash on the
    // string form is harmless at runtime — but the human-readable form
    // is also used in logs, where collisions would be confusing.
    let peer = PeerId::from("alice");
    let media = MediaSourceId::from_peer_and_track(&peer, "events");
    let dc = DataChannelSourceId::from_peer_and_label(&peer, "events");
    assert_ne!(media.as_str(), dc.as_str());
}

