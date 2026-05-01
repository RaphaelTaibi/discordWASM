// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! Data channel interceptor pipeline helpers.
//!
//! Kept in their own module so [`super::data_channel`] stays under the
//! 350 LOC budget while the hot SCTP path retains the same two-pass
//! ingress/egress contract as the RTP fan-out worker.

use std::sync::Arc;

use bytes::Bytes;

use crate::extension::{DataChannelContext, DataChannelInterceptor, DataChannelOutcome, Direction};
use crate::id::{DataChannelSourceId, PeerId};

/// Runs the ingress chain. Returns `true` when the message must be
/// dropped entirely (no destination should receive it).
pub(super) async fn run_dc_ingress(
    interceptors: &[Arc<dyn DataChannelInterceptor>],
    source_id: &DataChannelSourceId,
    label: &Arc<str>,
    is_string: &mut bool,
    payload: &mut Bytes,
) -> bool {
    for interceptor in interceptors.iter() {
        let ctx = DataChannelContext {
            source: source_id,
            destination: None,
            label: label.as_ref(),
            is_string: *is_string,
            direction: Direction::Ingress,
        };
        match interceptor.on_message(ctx, *is_string, payload).await {
            DataChannelOutcome::Forward => {}
            DataChannelOutcome::Drop => return true,
            DataChannelOutcome::Replace { is_string: s, data } => {
                *is_string = s;
                *payload = data;
            }
        }
    }
    false
}

/// Runs the egress chain for one destination. Returns `true` to skip it.
pub(super) async fn run_dc_egress(
    interceptors: &[Arc<dyn DataChannelInterceptor>],
    source_id: &DataChannelSourceId,
    label: &Arc<str>,
    dest_user: &PeerId,
    is_string: &mut bool,
    payload: &mut Bytes,
) -> bool {
    for interceptor in interceptors.iter() {
        let ctx = DataChannelContext {
            source: source_id,
            destination: Some(dest_user),
            label: label.as_ref(),
            is_string: *is_string,
            direction: Direction::Egress,
        };
        match interceptor.on_message(ctx, *is_string, payload).await {
            DataChannelOutcome::Forward => {}
            DataChannelOutcome::Drop => return true,
            DataChannelOutcome::Replace { is_string: s, data } => {
                *is_string = s;
                *payload = data;
            }
        }
    }
    false
}
