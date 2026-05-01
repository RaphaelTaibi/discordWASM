# `void-sfu` test layout

> See the package-level [`../README.md`](../README.md) for the architectural
> overview, public API tour and design rationale. This file only documents
> the **test layout** of the crate.

Tests live in this directory (per repository convention) and are split by
**purpose** so it stays trivial to find what is exercised where.

```text
tests/
├── README.md                         <-- you are here
├── unit_tests.rs                     <-- Cargo entry for unit tests
├── unit/
│   ├── mod.rs
│   ├── id_tests.rs                   newtype identifiers
│   ├── models_tests.rs               wire-format-agnostic value types
│   └── extension_defaults_tests.rs   trait default implementations
├── integration_tests.rs              <-- Cargo entry for integration tests
└── integration/
    └── sfu_lifecycle_tests.rs        Sfu::new + add/remove peer flow
```

## How Cargo discovers tests

Cargo treats each `.rs` file directly under `tests/` as a separate
integration test binary. Sub-directories are **not** auto-discovered;
they are pulled in via `mod ...;` declarations from the top-level entry
files (`unit_tests.rs`, `integration_tests.rs`).

This produces two clean test binaries — one per category — while still
letting us group tests by module under sub-folders.

## Where genuinely-internal tests live

A handful of types (`JitterBuffer`, …) are crate-private by design and
are tested inline with `#[cfg(test)] mod tests` next to their source.
Rust's privacy rules do not allow integration tests to reach
`pub(crate)` items, so those tests stay co-located with the implementation
they validate. Anything reachable through the public API is tested from
this directory instead.

## Running

```bash
cargo test -p void-sfu                    # all tests
cargo test -p void-sfu --test unit_tests
cargo test -p void-sfu --test integration_tests
```

