// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! Tests for the wire-format-agnostic value types in `models.rs`.

use void_sfu::IceCandidate;

#[test]
fn ice_candidate_new_sets_optional_fields_to_none() {
    let c = IceCandidate::new(
        "candidate:1 1 udp 2122260223 192.0.2.1 49152 typ host",
        None,
    );
    assert_eq!(
        c.candidate,
        "candidate:1 1 udp 2122260223 192.0.2.1 49152 typ host"
    );
    assert!(c.sdp_mid.is_none());
    assert!(c.sdp_mline_index.is_none());
    assert!(c.username_fragment.is_none());
}

#[test]
fn ice_candidate_carries_sdp_mid_when_provided() {
    let c = IceCandidate::new("candidate:foo", Some("0".to_string()));
    assert_eq!(c.sdp_mid.as_deref(), Some("0"));
}

#[test]
fn ice_candidate_clone_preserves_all_fields() {
    let c = IceCandidate {
        candidate: "candidate:1 1 udp 100 192.0.2.1 1 typ host".to_string(),
        sdp_mid: Some("audio".to_string()),
        sdp_mline_index: Some(0),
        username_fragment: Some("ufrag".to_string()),
    };
    let copy = c.clone();
    assert_eq!(c, copy);
}
