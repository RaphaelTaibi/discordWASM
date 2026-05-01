/**
 * Singleton WASM initialization and typed codec re-exports.
 * Always call `ensureWasm()` before any encode/decode operation.
 */
import init, {
    decode_auth_response,
    decode_user_profile,
    decode_user_summary_list,
    decode_pending_request_list,
    decode_status_response,
    decode_friend_request_result,
    decode_removed_response,
    encode_register_body,
    encode_login_body,
    encode_update_profile,
    encode_friend_request_body,
} from '../pkg/core_wasm';

let _ready: Promise<void> | null = null;

/** Idempotent WASM initialisation — safe to call multiple times. */
export function ensureWasm(): Promise<void> {
    if (!_ready) {
        _ready = init().then(() => undefined);
    }
    return _ready as Promise<void>;
}

export {
    decode_auth_response as decodeAuthResponse,
    decode_user_profile as decodeUserProfile,
    decode_user_summary_list as decodeUserSummaryList,
    decode_pending_request_list as decodePendingRequestList,
    decode_status_response as decodeStatusResponse,
    decode_friend_request_result as decodeFriendRequestResult,
    decode_removed_response as decodeRemovedResponse,
    encode_register_body as encodeRegisterBody,
    encode_login_body as encodeLoginBody,
    encode_update_profile as encodeUpdateProfile,
    encode_friend_request_body as encodeFriendRequestBody,
};
