// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! Compile-time and runtime checks on the public extension traits.
//!
//! The point is to lock the API contract: hosts (and future WASM glue
//! crates) must be able to provide a no-op interceptor by implementing
//! the trait with an *empty body*. If this file ever stops compiling, an
//! incompatible change has been introduced and downstream consumers will
//! need to migrate.

use std::sync::Arc;

use async_trait::async_trait;
use void_sfu::{
    CodecPolicy, DataChannelInterceptor, DataChannelOutcome, PacketInterceptor, SfuConfig,
};

struct NoopRtp;

#[async_trait]
impl PacketInterceptor for NoopRtp {}

struct AllowAll;

impl CodecPolicy for AllowAll {}

struct NoopDc;

#[async_trait]
impl DataChannelInterceptor for NoopDc {}

#[test]
fn empty_interceptor_impls_compile_and_register_into_config() {
    let mut cfg = SfuConfig::default();
    cfg.interceptors
        .push(Arc::new(NoopRtp) as Arc<dyn PacketInterceptor>);
    cfg.dc_interceptors
        .push(Arc::new(NoopDc) as Arc<dyn DataChannelInterceptor>);
    cfg.codec_policy = Some(Arc::new(AllowAll) as Arc<dyn CodecPolicy>);

    assert_eq!(cfg.interceptors.len(), 1);
    assert_eq!(cfg.dc_interceptors.len(), 1);
    assert!(cfg.codec_policy.is_some());
}

#[test]
fn data_channel_outcome_variants_are_publicly_constructible() {
    // Locks the variant set: hosts depend on these for plugin behavior.
    let _ = DataChannelOutcome::Forward;
    let _ = DataChannelOutcome::Drop;
    let _ = DataChannelOutcome::Replace {
        is_string: true,
        data: bytes::Bytes::from_static(b"ok"),
    };
}
