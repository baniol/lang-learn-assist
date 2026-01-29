# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Language Learning Assistant - a Tauri desktop application for practicing foreign language conversations with LLM integration. Users can have AI-powered conversations, extract phrases for spaced repetition learning, and practice with voice input (Whisper) and text-to-speech output.

## Development Commands

```bash
# Install dependencies
make install

# Development (Tauri + Vite)
make dev

# Production build
make build

# TypeScript type checking
make type-check

# Run Rust tests
make test-rust

# Clean build artifacts
make clean
```

Note: macOS builds require `MACOSX_DEPLOYMENT_TARGET=10.15` (handled by Makefile).

## Architecture

### Frontend (React + TypeScript)
- `src/App.tsx` - Main app with view-based navigation (no router library)
- `src/views/` - Main screens: Dashboard, Conversation, ConversationReview, PhraseLibrary, Learn, Settings
- `src/components/` - Reusable UI: Layout, ConversationMessage, PhraseCard, VoiceButton
- `src/hooks/` - Custom hooks: useConversation (chat state), useTTS (text-to-speech), useVoiceRecording (mic input)
- `src/lib/` - Utility functions for audio, LLM, TTS
- `src/types/index.ts` - All TypeScript interfaces and type definitions

Navigation uses a simple state-based approach: `onNavigate(view: ViewType, data?: unknown)` pattern.

### Backend (Rust + Tauri)
- `src-tauri/src/lib.rs` - Tauri app initialization, plugin registration, command handler setup
- `src-tauri/src/commands/` - Tauri commands organized by domain:
  - `settings.rs` - App settings (LLM/TTS provider config)
  - `conversations.rs` - CRUD for conversation sessions
  - `phrases.rs` - Phrase management (prompts/answers for learning)
  - `learning.rs` - Spaced repetition logic, practice sessions, progress tracking
  - `llm.rs` - OpenAI/Anthropic API integration for conversations
  - `audio.rs` - Whisper model management and transcription
  - `tts.rs` - Text-to-speech generation (ElevenLabs/Google/Azure)
- `src-tauri/src/db.rs` - SQLite database setup and schema
- `src-tauri/src/models.rs` - Data structures
- `src-tauri/src/state.rs` - Application state management

### Key Integrations
- **Whisper** (whisper-rs with Metal): Local speech-to-text transcription
- **LLM Providers**: OpenAI and Anthropic for conversation AI
- **TTS Providers**: ElevenLabs, Google Cloud, Azure for voice synthesis
- **SQLite**: Local data persistence for conversations, phrases, and learning progress

### Data Flow
1. User configures API keys in Settings
2. Start conversation -> LLM generates responses
3. Review conversation -> Extract phrases for learning
4. Practice phrases -> Spaced repetition with voice/typing input
