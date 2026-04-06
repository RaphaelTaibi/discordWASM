/**
 * Builds a Discord-style user tag from a pseudo and a public key.
 * @param pseudo - The user's display name.
 * @param publicKey - The full Ed25519 public key (hex or base64).
 * @returns A tag in the format `pseudo#XXXX` using the last 4 characters of the key.
 */
export const formatUserTag = (pseudo: string, publicKey: string): string => {
    if (!publicKey || publicKey.length < 4) return pseudo;
    const _suffix = publicKey.slice(-4).toUpperCase();
    return `${pseudo}#${_suffix}`;
};

