// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! SDP / ICE negotiation and track forwarding pipeline.
//!
//! Decomposed into focused submodules to respect the project-wide 350 LOC
//! file budget and to keep the hot RTP path (`tracks::spawn_fan_out_worker`)
//! easy to audit in isolation.
//!
//! Ordering note: the historic implementation scheduled the catchup
//! renegotiation offer *before* the answer to the peer's initial offer was
//! sent, leaving polite clients stuck in `have-local-offer` when the catchup
//! offer arrived. [`handlers::handle_offer`] now sends the answer first and
//! only then runs [`catchup::catchup_existing_tracks`].

mod catchup;
mod data_channel;
mod dc_interceptors;
mod fanout;
mod handlers;
mod renegotiate;
mod tracks;

pub(crate) use handlers::{handle_answer, handle_ice, handle_offer};
