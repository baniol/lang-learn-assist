//! Learning module - SRS-based phrase practice and review scheduling.
//!
//! This module is split into several submodules:
//! - `srs`: Core SRS algorithm for priority calculation and review scheduling
//! - `selection`: Phrase selection logic based on SRS priorities
//! - `answer`: Answer recording and validation
//! - `stats`: Learning statistics and SRS analytics
//! - `session`: Practice session management

pub mod answer;
pub mod selection;
pub mod session;
pub mod srs;
pub mod stats;
