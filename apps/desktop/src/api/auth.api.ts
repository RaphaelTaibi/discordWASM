import { apiFetchProto } from './http-client';
import {
    ensureWasm,
    encodeRegisterBody,
    encodeLoginBody,
    encodeUpdateProfile,
    decodeAuthResponse,
    decodeUserProfile,
    decodeUserSummaryList,
} from '../lib/wasm-codec';
import {
    AuthResponse,
    UpdateProfilePayload,
    UserProfile,
    UserSummary,
} from '../models/serverAuth.model';

/**
 * POST /api/auth/register
 * @param username - Unique login name (min 2 chars, lowercased server-side).
 * @param password - Cleartext password (min 4 chars, hashed server-side).
 * @param displayName - Display name shown to other users.
 * @param publicKey - Optional Ed25519 public key from local identity.
 */
export const registerAccount = async (
    username: string,
    password: string,
    displayName: string,
    publicKey?: string | null,
): Promise<AuthResponse> => {
    await ensureWasm();
    const bytes = encodeRegisterBody({ username, password, displayName, publicKey: publicKey ?? undefined });
    const res = await apiFetchProto('/api/auth/register', { method: 'POST', body: bytes });
    return decodeAuthResponse(res) as AuthResponse;
};

/**
 * POST /api/auth/login
 * @param username - Login name.
 * @param password - Cleartext password.
 */
export const loginAccount = async (
    username: string,
    password: string,
): Promise<AuthResponse> => {
    await ensureWasm();
    const bytes = encodeLoginBody({ username, password });
    const res = await apiFetchProto('/api/auth/login', { method: 'POST', body: bytes });
    return decodeAuthResponse(res) as AuthResponse;
};

/** GET /api/auth/me — returns the authenticated user's profile. */
export const getMe = async (): Promise<UserProfile> => {
    await ensureWasm();
    const res = await apiFetchProto('/api/auth/me');
    return decodeUserProfile(res) as UserProfile;
};

/**
 * PATCH /api/auth/me — updates the authenticated user's profile.
 * @param payload - Fields to update (displayName, avatar).
 */
export const updateMe = async (payload: UpdateProfilePayload): Promise<UserProfile> => {
    await ensureWasm();
    const bytes = encodeUpdateProfile(payload);
    const res = await apiFetchProto('/api/auth/me', { method: 'PATCH', body: bytes });
    return decodeUserProfile(res) as UserProfile;
};

/**
 * GET /api/auth/users/search?q=<query>
 * @param query - Search string matched against username and displayName.
 */
export const searchUsers = async (query: string): Promise<UserSummary[]> => {
    await ensureWasm();
    const res = await apiFetchProto(`/api/auth/users/search?q=${encodeURIComponent(query)}`);
    return decodeUserSummaryList(res) as UserSummary[];
};
