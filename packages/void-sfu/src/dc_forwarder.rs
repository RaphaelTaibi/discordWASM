// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! Data channel forwarder state.

use std::sync::Arc;

use dashmap::DashMap;
use webrtc::data_channel::RTCDataChannel;

use crate::id::{DataChannelSourceId, PeerId};

/// Per-source data channel forwarder.
///
/// Mirrors [`crate::forwarder::ForwarderState`] but for SCTP data channels.
/// On the publisher side the SFU listens to `on_message`; on each
/// destination peer the SFU owns a matching local `RTCDataChannel` it sends
/// the relayed payload through.
#[allow(dead_code)] // Several fields are kept for diagnostics / catchup.
pub(crate) struct DataChannelForwarder {
    pub source_id: DataChannelSourceId,
    pub source_peer: PeerId,
    pub label: Arc<str>,
    pub ordered: bool,
    pub max_packet_life_time: Option<u16>,
    pub max_retransmits: Option<u16>,
    pub protocol: Arc<str>,
    /// Per-destination data channels (one local DC per subscriber peer).
    pub destination_channels: Arc<DashMap<PeerId, Arc<RTCDataChannel>>>,
}
