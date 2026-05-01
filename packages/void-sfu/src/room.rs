// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

use std::sync::Arc;

use dashmap::{DashMap, DashSet};

use crate::dc_forwarder::DataChannelForwarder;
use crate::forwarder::ForwarderState;
use crate::id::{DataChannelSourceId, MediaSourceId, PeerId, RoomId};

/// Snapshot of an existing peer in a room, returned by [`crate::Sfu::join_room`].
#[derive(Debug, Clone)]
pub struct RoomPeer {
    pub peer_id: PeerId,
}

/// Runtime state of a single room.
///
/// `members`, `forwarders` and `dc_forwarders` are concurrent maps so the
/// hot RTP/SCTP paths (read on every packet/message) never block behind a
/// global write lock.
#[allow(dead_code)] // `id` is kept for diagnostics / observer payloads.
pub(crate) struct RoomState {
    pub id: RoomId,
    pub members: DashSet<PeerId>,
    /// One forwarder per published media source. Keyed by [`MediaSourceId`]
    /// so a single peer may publish multiple tracks (e.g. several cameras,
    /// audio + video, or arbitrary additional media kinds) without
    /// collisions.
    pub forwarders: DashMap<MediaSourceId, Arc<ForwarderState>>,
    /// One forwarder per published data channel. Keyed by
    /// [`DataChannelSourceId`] so a peer may publish multiple labelled
    /// channels in the same room.
    pub dc_forwarders: DashMap<DataChannelSourceId, Arc<DataChannelForwarder>>,
    pub started_at_ms: u64,
}

impl RoomState {
    pub fn new(id: RoomId, started_at_ms: u64) -> Self {
        Self {
            id,
            members: DashSet::new(),
            forwarders: DashMap::new(),
            dc_forwarders: DashMap::new(),
            started_at_ms,
        }
    }
}
