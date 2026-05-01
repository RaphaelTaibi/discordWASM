//! WASM-exposed protobuf encode/decode functions.
//! Each function bridges between JS values and binary protobuf.

use prost::Message;
use wasm_bindgen::prelude::*;

use crate::proto;

// ---------------------------------------------------------------------------
// Decode helpers (protobuf bytes → JsValue)
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub fn decode_auth_response(bytes: &[u8]) -> Result<JsValue, JsError> {
    let msg = proto::AuthResponse::decode(bytes)
        .map_err(|e| JsError::new(&format!("proto decode: {e}")))?;
    serde_wasm_bindgen::to_value(&msg).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen]
pub fn decode_user_profile(bytes: &[u8]) -> Result<JsValue, JsError> {
    let msg = proto::UserProfile::decode(bytes)
        .map_err(|e| JsError::new(&format!("proto decode: {e}")))?;
    serde_wasm_bindgen::to_value(&msg).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen]
pub fn decode_user_summary_list(bytes: &[u8]) -> Result<JsValue, JsError> {
    let msg = proto::UserSummaryList::decode(bytes)
        .map_err(|e| JsError::new(&format!("proto decode: {e}")))?;
    serde_wasm_bindgen::to_value(&msg.items).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen]
pub fn decode_pending_request_list(bytes: &[u8]) -> Result<JsValue, JsError> {
    let msg = proto::PendingRequestList::decode(bytes)
        .map_err(|e| JsError::new(&format!("proto decode: {e}")))?;
    serde_wasm_bindgen::to_value(&msg.items).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen]
pub fn decode_status_response(bytes: &[u8]) -> Result<JsValue, JsError> {
    let msg = proto::StatusResponse::decode(bytes)
        .map_err(|e| JsError::new(&format!("proto decode: {e}")))?;
    serde_wasm_bindgen::to_value(&msg).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen]
pub fn decode_friend_request_result(bytes: &[u8]) -> Result<JsValue, JsError> {
    let msg = proto::FriendRequestResult::decode(bytes)
        .map_err(|e| JsError::new(&format!("proto decode: {e}")))?;
    serde_wasm_bindgen::to_value(&msg).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen]
pub fn decode_removed_response(bytes: &[u8]) -> Result<JsValue, JsError> {
    let msg = proto::RemovedResponse::decode(bytes)
        .map_err(|e| JsError::new(&format!("proto decode: {e}")))?;
    serde_wasm_bindgen::to_value(&msg).map_err(|e| JsError::new(&e.to_string()))
}

// ---------------------------------------------------------------------------
// Encode helpers (JsValue → protobuf bytes)
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub fn encode_register_body(val: JsValue) -> Result<Vec<u8>, JsError> {
    let body: proto::RegisterBody =
        serde_wasm_bindgen::from_value(val).map_err(|e| JsError::new(&e.to_string()))?;
    Ok(body.encode_to_vec())
}

#[wasm_bindgen]
pub fn encode_login_body(val: JsValue) -> Result<Vec<u8>, JsError> {
    let body: proto::LoginBody =
        serde_wasm_bindgen::from_value(val).map_err(|e| JsError::new(&e.to_string()))?;
    Ok(body.encode_to_vec())
}

#[wasm_bindgen]
pub fn encode_update_profile(val: JsValue) -> Result<Vec<u8>, JsError> {
    let body: proto::UpdateProfileBody =
        serde_wasm_bindgen::from_value(val).map_err(|e| JsError::new(&e.to_string()))?;
    Ok(body.encode_to_vec())
}

#[wasm_bindgen]
pub fn encode_friend_request_body(val: JsValue) -> Result<Vec<u8>, JsError> {
    let body: proto::FriendRequestBody =
        serde_wasm_bindgen::from_value(val).map_err(|e| JsError::new(&e.to_string()))?;
    Ok(body.encode_to_vec())
}
