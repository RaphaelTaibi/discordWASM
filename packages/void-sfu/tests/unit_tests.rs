// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

//! Cargo integration-test entry for the unit test suite.
//!
//! Cargo only discovers `.rs` files placed *directly* under `tests/`.
//! This file pulls in the grouped sub-modules so they all compile and run
//! as a single test binary.

mod unit;

