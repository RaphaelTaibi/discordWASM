use std::path::Path;
use std::sync::Arc;

use dashmap::DashMap;
use prost::Message;
use tokio::sync::Notify;

use super::{FINGERPRINT_BANS_TOTAL, PERMANENT_BANS_TOTAL};

// ---------------------------------------------------------------------------
// Protobuf record for persisted bans
// ---------------------------------------------------------------------------

#[derive(Clone, PartialEq, prost::Message)]
pub struct BanRecord {
    #[prost(string, tag = "1")]
    pub ip: String,
    #[prost(string, tag = "2")]
    pub reason: String,
    #[prost(int64, tag = "3")]
    pub banned_at_ms: i64,
    /// 0 = permanent ban.
    #[prost(int64, tag = "4")]
    pub expires_at_ms: i64,
}

/// Tracks how many times an IP has been banned recently (recidivism).
#[derive(Clone, PartialEq, prost::Message)]
pub struct RecidivismRecord {
    #[prost(string, tag = "1")]
    pub ip: String,
    /// Timestamps (epoch ms) of each ban within the sliding window.
    #[prost(int64, repeated, tag = "2")]
    pub ban_timestamps_ms: Vec<i64>,
}

/// Maps a device fingerprint to the set of distinct IPs that used it.
#[derive(Clone, PartialEq, prost::Message)]
pub struct FingerprintRecord {
    #[prost(string, tag = "1")]
    pub fingerprint: String,
    #[prost(string, repeated, tag = "2")]
    pub ips: Vec<String>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub struct BanSnapshot {
    #[prost(message, repeated, tag = "1")]
    pub bans: Vec<BanRecord>,
    #[prost(message, repeated, tag = "2")]
    pub recidivism: Vec<RecidivismRecord>,
    #[prost(message, repeated, tag = "3")]
    pub fingerprints: Vec<FingerprintRecord>,
}

// ---------------------------------------------------------------------------
// In-memory ban store
// ---------------------------------------------------------------------------

/// Number of bans within the recidivism window that triggers a permanent ban.
const RECIDIVISM_THRESHOLD: usize = 3;

/// Recidivism sliding window: 7 days in milliseconds.
const RECIDIVISM_WINDOW_MS: i64 = 7 * 24 * 60 * 60 * 1000;

/// When a single fingerprint appears on this many distinct IPs, all are banned.
const FINGERPRINT_IP_LIMIT: usize = 50;

#[derive(Clone)]
pub struct BanStore {
    pub entries: Arc<DashMap<String, BanRecord>>,
    pub(crate) recidivism: Arc<DashMap<String, RecidivismRecord>>,
    pub(crate) fingerprints: Arc<DashMap<String, FingerprintRecord>>,
    pub(crate) dirty: Arc<Notify>,
    pub(crate) path: Arc<String>,
}

impl BanStore {
    /// Loads or creates the ban store from a `.bin` file.
    pub fn load(path: &str) -> Self {
        let entries = Arc::new(DashMap::new());
        let recidivism = Arc::new(DashMap::new());
        let fingerprints = Arc::new(DashMap::new());

        if let Ok(bytes) = std::fs::read(path) {
            if let Ok(snap) = BanSnapshot::decode(bytes.as_slice()) {
                for b in snap.bans {
                    entries.insert(b.ip.clone(), b);
                }
                for r in snap.recidivism {
                    recidivism.insert(r.ip.clone(), r);
                }
                for f in snap.fingerprints {
                    fingerprints.insert(f.fingerprint.clone(), f);
                }
                tracing::info!(
                    "Loaded ban store ({} bans, {} recidivism, {} fingerprints)",
                    entries.len(),
                    recidivism.len(),
                    fingerprints.len()
                );
            }
        }

        Self {
            entries,
            recidivism,
            fingerprints,
            dirty: Arc::new(Notify::new()),
            path: Arc::new(path.to_string()),
        }
    }

    /// Returns `true` if the IP is currently banned.
    pub fn is_banned(&self, ip: &str) -> bool {
        if let Some(record) = self.entries.get(ip) {
            if record.expires_at_ms == 0 {
                return true; // permanent
            }
            let now = epoch_ms();
            if now < record.expires_at_ms {
                return true;
            }
            // expired — remove lazily
            drop(record);
            self.entries.remove(ip);
            self.dirty.notify_one();
        }
        false
    }

    /// Bans an IP with a reason and optional duration (0 = permanent).
    /// Automatically escalates to permanent ban after repeated offenses.
    pub fn ban(&self, ip: String, reason: String, duration_ms: i64) {
        let now = epoch_ms();
        let effective_duration = self.apply_recidivism(&ip, now, duration_ms);
        let expires = if effective_duration == 0 {
            0
        } else {
            now + effective_duration
        };
        self.entries.insert(
            ip.clone(),
            BanRecord {
                ip,
                reason,
                banned_at_ms: now,
                expires_at_ms: expires,
            },
        );
        self.dirty.notify_one();
    }

    /// Updates the recidivism record for an IP and returns the effective
    /// ban duration (0 = permanent if threshold exceeded).
    fn apply_recidivism(&self, ip: &str, now: i64, requested_duration: i64) -> i64 {
        if requested_duration == 0 {
            return 0; // already permanent
        }

        let cutoff = now - RECIDIVISM_WINDOW_MS;
        let mut entry = self
            .recidivism
            .entry(ip.to_string())
            .or_insert_with(|| RecidivismRecord {
                ip: ip.to_string(),
                ban_timestamps_ms: Vec::new(),
            });

        let record = entry.value_mut();
        record.ban_timestamps_ms.retain(|&ts| ts > cutoff);
        record.ban_timestamps_ms.push(now);

        if record.ban_timestamps_ms.len() >= RECIDIVISM_THRESHOLD {
            PERMANENT_BANS_TOTAL.inc();
            tracing::warn!(
                "IP {ip} reached recidivism threshold ({RECIDIVISM_THRESHOLD} bans in 7d) — permanent ban"
            );
            0
        } else {
            requested_duration
        }
    }

    /// Associates a device fingerprint with the connecting IP.
    /// If the fingerprint has been seen from too many distinct IPs,
    /// permanently bans all of them and returns the list of banned IPs.
    pub fn record_fingerprint(&self, fingerprint: &str, ip: &str) -> Vec<String> {
        let mut entry = self
            .fingerprints
            .entry(fingerprint.to_string())
            .or_insert_with(|| FingerprintRecord {
                fingerprint: fingerprint.to_string(),
                ips: Vec::new(),
            });

        let record = entry.value_mut();
        if !record.ips.contains(&ip.to_string()) {
            record.ips.push(ip.to_string());
        }

        if record.ips.len() >= FINGERPRINT_IP_LIMIT {
            let ips_to_ban = record.ips.clone();
            let reason = format!("fingerprint_abuse:{fingerprint}");
            for banned_ip in &ips_to_ban {
                self.entries.insert(
                    banned_ip.clone(),
                    BanRecord {
                        ip: banned_ip.clone(),
                        reason: reason.clone(),
                        banned_at_ms: epoch_ms(),
                        expires_at_ms: 0, // permanent
                    },
                );
            }
            FINGERPRINT_BANS_TOTAL.inc_by(ips_to_ban.len() as u64);
            tracing::warn!(
                "Fingerprint {fingerprint} seen on {} IPs — all permanently banned",
                ips_to_ban.len()
            );
            self.dirty.notify_one();
            return ips_to_ban;
        }

        self.dirty.notify_one();
        Vec::new()
    }

    /// Flushes all bans, recidivism and fingerprint records to disk.
    pub fn flush(&self) -> Result<(), String> {
        let bans: Vec<BanRecord> = self.entries.iter().map(|r| r.value().clone()).collect();
        let recidivism: Vec<RecidivismRecord> =
            self.recidivism.iter().map(|r| r.value().clone()).collect();
        let fingerprints: Vec<FingerprintRecord> = self
            .fingerprints
            .iter()
            .map(|r| r.value().clone())
            .collect();
        let snap = BanSnapshot {
            bans,
            recidivism,
            fingerprints,
        };
        let buf = snap.encode_to_vec();

        let path = Path::new(self.path.as_str());
        let tmp = path.with_extension("bin.tmp");
        std::fs::write(&tmp, &buf).map_err(|e| format!("write tmp: {e}"))?;
        if path.exists() {
            std::fs::remove_file(path).map_err(|e| format!("remove old: {e}"))?;
        }
        std::fs::rename(&tmp, path).map_err(|e| format!("rename: {e}"))?;
        tracing::info!("Ban store flushed ({} entries)", self.entries.len());
        Ok(())
    }
}

/// Spawns a background flusher for the ban store.
/// Disk I/O runs on the blocking threadpool.
pub fn spawn_flusher(store: BanStore) {
    tokio::spawn(async move {
        loop {
            store.dirty.notified().await;
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            let store_ref = store.clone();
            match tokio::task::spawn_blocking(move || store_ref.flush()).await {
                Ok(Err(e)) => tracing::error!("Ban store flush failed: {e}"),
                Err(e) => tracing::error!("Ban store flush task panicked: {e}"),
                _ => {}
            }
        }
    });
}

fn epoch_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
