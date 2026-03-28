use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn check_quality(bitrate: u32) -> String {
    if bitrate < 5000 {
        format!("Bitrate faible: {} kbps - Qualité SD", bitrate)
    } else {
        format!("Bitrate actuel: {} kbps - Analysé par Rust", bitrate)
    }
}

// Analyse des pixels
#[wasm_bindgen]
pub fn analyze_frame(data: &[u8], width: u32, height: u32) -> String {

    // Calcule de la luminosité moyenne
    let mut total: u64 = 0;
    for i in (0..data.len()).step_by(4) {
        total += data[i] as u64; 
    }

    let avg = total / (width * height) as u64;
    format!("Frame {}x{} - Luminosité moyenne (R): {}", width, height, avg)
}