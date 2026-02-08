//! LLM module - AI-powered language learning features.
//!
//! This module is split into several submodules:
//! - `client`: HTTP client for OpenAI and Anthropic APIs, connection testing
//! - `types`: Request/response types for LLM operations
//! - `prompts`: System prompt builders for various use cases
//! - `phrase`: Phrase refinement and title generation
//! - `material`: Material processing and sentence Q&A
//! - `deck_generation`: AI-powered deck creation with CEFR levels

pub mod client;
pub mod deck_generation;
pub mod material;
pub mod phrase;
pub mod prompts;
pub mod types;
