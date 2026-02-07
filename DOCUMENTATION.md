# Lang Learn Assistant - User Guide

A desktop app for language learning through AI conversations, phrase extraction, and spaced repetition practice.

## Core Concepts

### Phrase Lifecycle

Phrases in Lang Learn Assistant follow a clear learning path:

```
Phrase Created (from conversation/materials)
         ↓
    [Inactive] ← Sits in phrase library, not learnable
         ↓
    Add to Deck
         ↓
    [Deck Learning] ← Practice until graduation
         ↓
    Graduate (reach threshold)
         ↓
    [SRS Active] ← Long-term spaced repetition
```

### Learning Status

Each phrase has one of three statuses:

- **Inactive**: Phrase exists but isn't being learned. Add it to a deck to start learning.
- **Deck Learning**: Phrase is in a deck and being actively practiced. Answer correctly multiple times to graduate.
- **SRS Active**: Phrase has graduated from its deck and is now in the spaced repetition system for long-term retention.

## Features

### Conversations

Practice conversations with AI in your target language. The AI adapts to your level and helps you learn naturally.

1. Create a new conversation with a topic
2. Chat with the AI in your target language
3. Finalize the conversation to extract useful phrases

### Materials

Import text content (articles, transcripts) for study:

1. Paste or import text in your target language
2. The app segments and translates the content
3. Study segment by segment
4. Extract phrases for practice

### Phrase Library

Central repository for all your phrases:

- View all extracted phrases
- Star important phrases
- Exclude phrases you don't want to learn
- Assign phrases to decks for learning
- Bulk actions for organizing phrases

### Decks

Decks are how you organize and learn new phrases:

1. **Create a deck** with a name and graduation threshold (default: 2 correct answers)
2. **Add phrases** from the Phrase Library
3. **Study** the deck until phrases graduate
4. **Reset** the deck if you want to practice again

#### Graduation

When practicing a deck:
- Each correct answer increases the phrase's progress
- Each wrong answer decreases progress by 1 (minimum 0)
- When progress reaches the graduation threshold, the phrase "graduates" to SRS
- Graduated phrases no longer appear in deck study

#### Deck Reset

Use the reset button (refresh icon) to:
- Reset all phrase progress in the deck to 0
- Move graduated phrases back to "deck learning" status
- Start fresh with the entire deck

### Review (SRS)

The Review section is for spaced repetition of graduated phrases:

- Only phrases with **SRS Active** status appear here
- Review intervals increase as you answer correctly
- Wrong answers reduce the interval (soft reset)
- Focuses on long-term retention

### Practice Modes

Three exercise modes are available:

1. **Manual**: See prompt, reveal answer, self-grade
2. **Typing**: Type your answer, auto-checked
3. **Speaking**: Speak your answer, transcribed and checked

### Questions

Ask grammar and style questions about your target language:

- Get explanations with examples
- Save useful examples as phrases
- Build understanding of language patterns

### Notes

Quick notes for anything you want to remember:

- Jot down grammar rules
- Save vocabulary lists
- Record learning insights

## Settings

### Language Settings

- **Target Language**: The language you're learning
- **Native Language**: Your native language for translations

### Practice Settings

- **Required Streak**: Correct answers needed before moving on (SRS)
- **Immediate Retry**: Retry wrong answers immediately
- **Session Phrase Limit**: Max phrases per session (0 = unlimited)
- **New Phrases Per Session**: Limit on new phrases introduced
- **New Phrase Interval**: How often to introduce new phrases
- **Fuzzy Matching**: Allow minor typos in answers

### AI Settings

- **LLM Provider**: OpenAI or Anthropic for conversations
- **TTS Provider**: Text-to-speech for audio playback
- **Whisper Model**: Speech recognition model for speaking mode

## Tips

1. **Start with decks**: Add phrases to decks before trying to learn them
2. **Small decks**: Keep decks focused (10-20 phrases) for effective learning
3. **Regular review**: Check the Review section daily for SRS items
4. **Use conversations**: Natural context helps phrases stick
5. **Reset when needed**: Don't hesitate to reset a deck if you need more practice
