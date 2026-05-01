// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

use std::time::Instant;

/// Tracks packets/bytes forwarded to a single destination peer.
///
/// Updated in batches by the forwarding worker to minimise lock contention.
#[derive(Debug, Clone)]
pub struct ForwardingStats {
    pub packets_sent: u64,
    pub bytes_sent: u64,
    pub last_update: Instant,
}

impl ForwardingStats {
    #[inline]
    pub fn new() -> Self {
        Self {
            packets_sent: 0,
            bytes_sent: 0,
            last_update: Instant::now(),
        }
    }

    #[inline]
    pub fn update(&mut self, packets: u64, bytes: u64) {
        self.packets_sent = self.packets_sent.saturating_add(packets);
        self.bytes_sent = self.bytes_sent.saturating_add(bytes);
        self.last_update = Instant::now();
    }

    /// Approximate bandwidth (bits per second) since stats inception.
    pub fn bandwidth_bps(&self) -> u64 {
        let elapsed = self.last_update.elapsed().as_secs_f64();
        if elapsed > 0.0 {
            ((self.bytes_sent as f64 / elapsed) * 8.0) as u64
        } else {
            0
        }
    }
}

impl Default for ForwardingStats {
    fn default() -> Self {
        Self::new()
    }
}
