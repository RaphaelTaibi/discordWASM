/**
 * Extracts a short visual fingerprint from a base64-encoded public key.
 * Used to help differentiate users who share the same display name.
 *
 * @param publicKey - Base64-encoded Ed25519 public key.
 * @param length - Number of characters for the tag (default 4).
 * @returns A short hex-like tag, e.g. "f3a2".
 */
export function identityTag(publicKey: string, length = 4): string {
    const _clean = publicKey.replace(/=+$/, '');
    return _clean.slice(-length).toLowerCase();
}

/**
 * Formats a display name with its identity fingerprint.
 *
 * @returns Formatted string, e.g. "Alice #f3a2".
 */
export function displayNameWithTag(pseudo: string, publicKey: string): string {
    return `${pseudo} #${identityTag(publicKey)}`;
}

