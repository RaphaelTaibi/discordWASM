/** Public metadata for an identity (secrets never leave the Rust backend). */
export default interface Identity {
  timestamp: number;
  publicKey: string;
  pseudo: string;
  avatar?: string | null;
}

