export interface ServerMember {
    publicKey: string;
    displayName: string;
    username: string;
    avatar: string | null;
    isOwner: boolean;
    /** Live presence flag — `true` when the member's WS is connected. */
    online?: boolean;
}
