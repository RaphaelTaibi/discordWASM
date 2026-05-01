// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! Server-side renegotiation helper shared by track installation and catchup.

use std::sync::Arc;

use tracing::{debug, warn};

use crate::id::PeerId;
use crate::signal::{Outbound, SignalSink};

/// Triggers a server-initiated SDP renegotiation cycle: `create_offer` â†’
/// `set_local_description` â†’ deliver to the peer via its [`SignalSink`].
///
/// Failures are logged but never panic. The caller is expected to spawn this
/// off the hot path so glare with concurrent client offers cannot deadlock.
pub(super) async fn spawn_renegotiation_offer(
    pc: Arc<webrtc::peer_connection::RTCPeerConnection>,
    sink: Arc<dyn SignalSink>,
    peer: PeerId,
) {
    let offer = match pc.create_offer(None).await {
        Ok(o) => o,
        Err(e) => {
            warn!("renegotiation create_offer failed for {}: {:?}", peer, e);
            return;
        }
    };
    if let Err(e) = pc.set_local_description(offer.clone()).await {
        warn!("renegotiation set_local_description failed: {:?}", e);
        return;
    }
    let payload = offer.sdp.clone();
    if let Err(e) = sink.deliver(&peer, Outbound::Offer { sdp: payload }).await {
        debug!("renegotiation offer delivery failed: {:?}", e);
    }
}
