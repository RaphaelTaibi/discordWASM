export interface ServerChannel {
  id: string;
  name: string;
  type: 'text' | 'voice';
}

export interface Server {
  id: string;
  name: string;
  ownerPublicKey: string;
  inviteKey?: string;
  icon?: string;
  channels: ServerChannel[];
  members: string[];
}

