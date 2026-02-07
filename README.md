# Lang Learn Assistant

A desktop app for language learning through AI conversations, phrase extraction, and spaced repetition practice.

## Features

- **AI Conversations**: Practice natural conversations in your target language
- **Materials**: Import and study text content (articles, transcripts)
- **Phrase Library**: Central repository for all extracted phrases
- **Decks**: Organize phrases for focused learning sessions
- **Spaced Repetition**: Long-term retention through SRS review
- **Multiple Practice Modes**: Manual, typing, and speaking exercises

## Learning Flow

1. **Extract phrases** from conversations or materials
2. **Add to a deck** to start learning
3. **Practice** until phrases graduate (reach correct answer threshold)
4. **Review** graduated phrases with spaced repetition

See [DOCUMENTATION.md](./DOCUMENTATION.md) for detailed usage guide.

## Development

```bash
# Install dependencies
npm install

# Run development server
make dev

# Build for production
make build

# Run tests
make test-rust    # Rust tests
npm test          # Frontend tests
make type-check   # TypeScript check
```

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Rust, Tauri
- **Database**: SQLite
- **AI**: OpenAI/Anthropic for conversations, Whisper for speech recognition
