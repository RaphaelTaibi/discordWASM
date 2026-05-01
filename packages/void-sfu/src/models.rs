// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! Wire-format-agnostic value types used at the SFU's public boundary.
//!
//! These types intentionally avoid pulling `serde_json` into the public API:
//! the host application is free to encode them with protobuf, CBOR, JSON or
//! any other transport-specific format. Internally the crate maps them to
//! the corresponding `webrtc-rs` types without going through a JSON detour.

use std::sync::Arc;

/// ICE candidate exchanged between the SFU and a peer.
///
/// Mirrors the W3C `RTCIceCandidateInit` shape (and `webrtc-rs`'s
/// `RTCIceCandidateInit`) without inheriting its serde JSON contract.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IceCandidate {
    /// SDP candidate attribute string (e.g. `candidate:1 1 udp 2122260223 ...`).
    pub candidate: String,
    /// `a=mid` value identifying the media section the candidate applies to.
    pub sdp_mid: Option<String>,
    /// Index of the m-line the candidate applies to.
    pub sdp_mline_index: Option<u16>,
    /// ICE username fragment, when known.
    pub username_fragment: Option<String>,
}

impl IceCandidate {
    /// Convenience constructor for the most common case where only the
    /// `candidate` and `sdp_mid` are known.
    pub fn new(candidate: impl Into<String>, sdp_mid: Option<String>) -> Self {
        Self {
            candidate: candidate.into(),
            sdp_mid,
            sdp_mline_index: None,
            username_fragment: None,
        }
    }
}

/// Media kind hint surfaced internally on every forwarder (and on the
/// `kind` field of [`crate::Outbound::TrackMap`]).
///
/// String-typed at the API boundary to stay aligned with WebRTC's open-ended
/// kind taxonomy ("audio", "video", and future kinds such as "application"
/// for data-channel-bridged media).
pub type MediaKind = Arc<str>;
