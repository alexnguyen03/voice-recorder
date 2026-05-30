pub mod recording;
pub mod editing;

// Đóng gói các hàm và struct state để dùng trong main/lib
pub use recording::{list_audio_devices, start_audio_recording, stop_audio_recording, list_recorded_files, RecorderState, pause_audio_recording, resume_audio_recording, discard_audio_recording};
pub use editing::{trim_audio, apply_voice_effects, cut_audio_segment};
