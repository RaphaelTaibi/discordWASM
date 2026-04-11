import Identity from '../models/auth/identity.model';

/**
 * Maps a raw identity payload from the Rust backend (snake_case)
 * to the frontend Identity model (camelCase).
 * Handles both naming conventions for resilience.
 * @param raw - The raw object returned by a Tauri invoke call.
 * @returns A properly-shaped Identity object.
 */
export const mapIdentity = (raw: any): Identity => {
    return {
        timestamp: raw.timestamp,
        publicKey: raw.publicKey ?? raw.public_key,
        pseudo: raw.pseudo,
        avatar: raw.avatar ?? null,
    };
};

