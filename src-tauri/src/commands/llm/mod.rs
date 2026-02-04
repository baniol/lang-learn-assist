//! LLM module - AI-powered language learning features.
//!
//! This module is split into several submodules:
//! - `client`: HTTP client for OpenAI and Anthropic APIs
//! - `types`: Request/response types for LLM operations
//! - `prompts`: System prompt builders for various use cases
//! - `conversation`: Conversation translation and phrase extraction
//! - `phrase`: Phrase refinement and title generation
//! - `material`: Material processing and sentence Q&A

pub mod client;
pub mod conversation;
pub mod material;
pub mod phrase;
pub mod prompts;
pub mod types;
