# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Phrase exercise module with voice recognition and text input
- Exercise sets filterable by tags or all phrases
- Configurable repetition count (correct in a row) in settings
- Answer checking with fuzzy matching and accepted alternatives
- Exercise progress tracking with streak indicators
- Session results summary with accuracy and timing stats
- Per-phrase session data persistence (prompt, answer, attempts)
- Failed phrases list (attempts > 1) in daily stats view per session
- Orange highlighting for phrases requiring multiple attempts in exercise results

## [0.1.0] - 2026-03-17

### Added
- Phrase management with LLM-powered chat for adding phrases
- Tags feature for grouping phrases
- Practice sessions for conversational material practice
- AI conversation practice with configurable LLM settings
- Learning materials management
