# PROJECT CONSTITUTION
## Project: Desktop Voice Recorder (Tauri v2 + Rust + React)

This document defines the design philosophy, technical architecture, coding standards, and long-term maintenance rules for the project. Every change to the codebase must strictly adhere to this constitution.

---

## 1. Philosophy & Vision
* **AI-Agent-Native & Human-Maintainable**: The project is architected so that both AI agents (vibe coding) and human developers can collaborate with maximum efficiency. Code must be highly explicit, self-documenting, and free of ambiguity.
* **Local-First & Privacy-First**: 100% of the audio data is processed locally on the user's machine. No voice data or recordings are transmitted externally unless explicitly requested by the user.
* **Lightweight & High-Performance**: The application must start instantly, consume minimal memory (<100MB RAM), and maintain zero real-time audio glitching.
* **Premium & Fluid Visuals**: The UI should feel responsive, dark-mode native, and leverage high-fidelity, fluid real-time audio visualization.

---

## 2. Technical Architecture

The project enforces **Clean Architecture** on both the Backend and Frontend to isolate business logic from hardware or external dependencies, ensuring long-term maintainability.

### A. Backend Rust (Domain-Driven, Decoupled Core)
We separate the audio business logic from technical implementation details using **Traits**:

1. **Domain Layer (`core/`)**:
   * Contains pure data models (`models.rs`) and interfaces (`traits.rs`).
   * No dependencies on third-party audio I/O libraries (must not import cpal, symphonia, etc.).
   * Example:
     ```rust
     pub trait AudioRecorder {
         fn start_recording(&mut self, config: &RecordConfig) -> Result<(), AudioError>;
         fn stop_recording(&mut self) -> Result<AudioBuffer, AudioError>;
     }
     ```
2. **Infrastructure Layer (`infra/`)**:
   * Concrete implementations of Core traits.
   * `audio_cpal.rs` handles mic recording using `cpal`.
   * `dsp_engine.rs` handles audio filters, EQ, and noise suppression (RNNoise).
   * `storage_local.rs` handles WAV file encoding/decoding using `hound` or `symphonia`.
3. **Controller/IPC Layer (`commands/`)**:
   * Receives Tauri IPC calls from the frontend, coordinates services via Dependency Injection, and returns serialized results.

### B. Frontend React (Separation of Concerns)
* **Presenter Layer (`components/`)**: Pure presentation/UI components. They receive data through props and emit user interactions via callbacks. They must not make direct Tauri IPC invocations.
* **Controller Layer (`hooks/`)**: Custom hooks (e.g., `useAudioRecorder.ts`) that orchestrate UI state and delegate Tauri calls to the Service layer.
* **Service Layer (`services/`)**: Encapsulates Tauri IPC calls (`invoke`) into typed async TS functions, isolating React from Tauri's runtime specifics.
* **State Layer (`context/`)**: Manages global application states (e.g., selected device, recording history).

---

## 3. Required Design Patterns

1. **Dependency Inversion (DIP)**: The Rust backend must depend on abstractions (Traits) rather than concretions. Concretions are injected using Tauri App State.
2. **Command Pattern**: All IPC operations must be mapped to distinct, explicit Tauri Commands, with matched TypeScript interfaces matching Rust structs 1-1.
3. **Observer Pattern**: Real-time waveform data or background processing updates must be streamed from Rust to Frontend via Tauri's event broadcasting (`tauri::window::emit`).
4. **Adapter Pattern**: Third-party signal processing or hardware wrappers (like RNNoise or biquad filters) must be adapted to fit our internal Core interfaces.

---

## 4. Maintenance Rules for Humans
* **Platform Independence**: Never write OS-specific path separators. Always use Rust's `std::path::PathBuf` and avoid hardcoding paths.
* **Strict Error Handling**: Do not use `.unwrap()` or `.expect()` in Rust production code. Map all errors to a custom domain `AppError` and return `Result<T, AppError>`.
* **Self-Documentation**: All public modules and functions in Rust must be fully documented using `/// doc comments`. TS modules must have explicit JSDoc annotations.
