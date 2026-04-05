export interface ServerChannel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'video';
}

export interface Server {
  id: string;
  name: string;
  ownerPublicKey: string; // The Ed25519 public key of the creator
  inviteKey: string;      // Used for joining
  icon?: string;
  channels: ServerChannel[];
}

