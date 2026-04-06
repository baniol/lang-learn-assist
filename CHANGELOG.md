# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Settings header (title, save button, tabs) is now sticky — scrolls only the tab content
- Language selection in settings uses ElevenLabs language picker instead of free-form text input
- Language flags shown for all languages in settings (custom languages use 🌐)

## [0.2.0] - 2026-04-05

### Added
- Custom language support: add/remove languages in settings, available across all menus and TTS voice tabs
- Settings view split into tabs: AI, Speech, Languages, Data
- Delete any language (predefined or custom) with confirmation dialog — cascades to all phrases in that language

## [0.1.1] - 2026-04-03

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
- Session count badge on calendar days with multiple sessions
- Failed-phrase-aware progress bar and "Completed with errors" status in session cards

## [0.1.0] - 2026-03-17

### Added
- Phrase management with LLM-powered chat for adding phrases
- Tags feature for grouping phrases
- Practice sessions for conversational material practice
- AI conversation practice with configurable LLM settings
- Learning materials management
