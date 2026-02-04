# Language Learning Assistant - User Guide

A desktop application for practicing foreign language conversations with AI assistance, extracting phrases for spaced repetition learning, and practicing with voice input and text-to-speech.

---

## Table of Contents

1. [Overview](#overview)
2. [Conversations](#conversations)
3. [Phrase Library](#phrase-library)
4. [Learning & Practice](#learning--practice)
5. [Spaced Repetition System (SRS)](#spaced-repetition-system-srs)
6. [Voice Features](#voice-features)
7. [Settings](#settings)

---

## Overview

The app helps you learn a foreign language through three main activities:

1. **Conversations** - Have AI-powered translation conversations to discover how to say things in your target language
2. **Phrase Library** - Build a personal collection of phrases to learn
3. **Practice** - Review and memorize phrases using spaced repetition

### Supported Languages

- **Target languages** (what you're learning): German, English, French, Spanish, Italian
- **Native languages** (what you speak): Polish, English, German

---

## Conversations

### Starting a Conversation

1. Choose a topic category (Restaurant, Shopping, Travel, etc.) or create a custom topic
2. Select your target and native languages
3. Start typing what you want to say in your native language

### How It Works

- You write in your **native language** (e.g., Polish)
- The AI responds with a natural translation in your **target language** (e.g., German)
- Continue the conversation to explore different ways to express yourself
- The AI aims for B1-B2 vocabulary level - natural but not overly complex

### Reviewing Conversations

After a conversation, you can:

1. **Review and clean up** - The AI suggests a polished version of the conversation
2. **Extract phrases** - The AI identifies useful phrases worth learning
3. **Save to library** - Add selected phrases to your personal collection

---

## Phrase Library

Your personal collection of phrases to learn. Each phrase has:

- **Prompt** - The meaning in your native language (what you want to say)
- **Answer** - The correct phrase in your target language
- **Accepted alternatives** - Other valid ways to say the same thing
- **Notes** - Optional personal notes

### Managing Phrases

- **Star** phrases to mark favorites
- **Filter** by status: All, New, Learning, Learned
- **Search** to find specific phrases
- **Delete** phrases you no longer need

### Editing Phrases

Click the edit button on any phrase to open the editor with two modes:

**Manual Edit**
- Directly edit the prompt, answer, and accepted alternatives
- Full control over all fields

**AI Assistant**
- Chat with AI to refine your phrase
- Ask things like "Make this more casual" or "Add alternative forms"
- AI suggests changes - you decide which to accept
- Each suggestion has accept/reject buttons
- Continue the conversation to refine further

---

## Learning & Practice

### Exercise Modes

**Manual Mode**
1. See the prompt (native language)
2. Think of the answer
3. Reveal the correct answer
4. Self-grade: Correct or Incorrect

**Typing Mode**
1. See the prompt
2. Type your answer in the target language
3. System checks if your answer matches (with some flexibility for minor differences)

**Speaking Mode**
1. See the prompt
2. Press and hold the microphone button
3. Speak your answer in the target language
4. Voice is transcribed and checked automatically
5. Requires a Whisper model (download in Settings)

### During Practice

- See your session progress (phrases practiced, correct answers)
- Wrong answers show the correct answer with a "Try Again" button
- The answer stays visible until you're ready to continue
- End session anytime to return to dashboard

---

## Spaced Repetition System (SRS)

The app uses a proven spaced repetition algorithm (based on SM-2/Anki) to optimize your learning.

### Algorithm Flowchart

```mermaid
flowchart TD
    Start([Practice Phrase]) --> CheckAnswer{Answer<br/>Correct?}

    CheckAnswer -->|Yes| CheckPhase{In Learning<br/>Phase?<br/><i>streak < 2</i>}
    CheckAnswer -->|No| ReduceEase[Reduce Ease Factor<br/><i>ease -= 0.2, min 1.3</i>]

    ReduceEase --> ResetLearning[Reset to Learning Phase<br/><i>interval = 0</i>]
    ResetLearning --> ReviewSoon[Review in 5 min]

    CheckPhase -->|Yes| CheckGraduation{Ready to<br/>Graduate?<br/><i>streak+1 ≥ 2</i>}
    CheckPhase -->|No| IncreaseInterval[Increase Interval<br/><i>new = old × ease</i><br/><i>min: old + 1 day</i>]

    CheckGraduation -->|Yes| Graduate[Graduate to Review<br/><i>interval = 1 day</i>]
    CheckGraduation -->|No| StayLearning[Stay in Learning<br/><i>interval = 0</i>]

    StayLearning --> ReviewMinutes[Review in 10 min]
    Graduate --> ReviewDays[Review in 1 day]
    IncreaseInterval --> ScheduleNext[Schedule Next Review<br/><i>in [interval] days</i>]

    ReviewSoon --> End([Done])
    ReviewMinutes --> End
    ReviewDays --> End
    ScheduleNext --> End
```

### How It Works

Each phrase has:
- **Interval** - Days until next review
- **Ease factor** - How easy this phrase is for you (affects interval growth)
- **Next review date** - When you should see this phrase again

### The Algorithm

**Learning Phase** (new phrases, streak < 2):
- Correct answer: review in 10 minutes, until you get 2 in a row
- After 2 correct: "graduate" to review phase with 1-day interval

**Review Phase** (learned phrases, streak ≥ 2):
- Correct answer: `new interval = current interval × ease factor` (minimum +1 day)
- Phrases you know well appear less frequently

**Incorrect Answer** (any phase):
- Ease factor decreases by 0.2 (minimum 1.3)
- Reset to learning phase (review in 5 minutes)
- Must build up streak again to re-graduate

### Scheduling Priority

During practice, phrases are shown in this order:
1. **Overdue phrases** - Past their review date (most urgent first)
2. **New phrases** - Never practiced before
3. **Not yet due** - Skipped until their review date

### Example Progression

With all correct answers at default ease (2.5):

| # | Phase | Interval | Next Review |
|---|-------|----------|-------------|
| 1 | Learning | 0 | 10 minutes |
| 2 | Graduate | 1 | 1 day |
| 3 | Review | 3 | 3 days |
| 4 | Review | 8 | 1 week |
| 5 | Review | 20 | 3 weeks |
| 6 | Review | 50 | ~2 months |

This means well-known phrases eventually only appear once a month or less, while difficult phrases stay in frequent rotation.

### Phrase Status

- **New** - Never practiced
- **Learning** - Has been practiced but not yet mastered
- **Learned** - Achieved 2+ correct answers in a row

---

## Voice Features

### Text-to-Speech (TTS)

Listen to correct pronunciation of phrases. Supported providers:
- ElevenLabs
- Google Cloud
- Azure

Configure in Settings with your API key and preferred voice.

### Speech-to-Text (Whisper)

Speak your answers and have them transcribed automatically.

**Setup:**
1. Go to Settings
2. Download a Whisper model (Base recommended for balance of speed/accuracy)
3. Wait for download to complete
4. Speaking mode becomes available in Practice

**Available Models:**
- Tiny - Fastest, least accurate
- Base - Good balance (recommended)
- Small - More accurate, slower
- Medium - High accuracy, requires more resources

---

## Settings

### LLM Provider

Powers the AI conversations and phrase refinement.

- **Anthropic** (Claude) - Recommended
- **OpenAI** (GPT)

Requires an API key from your chosen provider.

### TTS Provider

For phrase pronunciation playback.

- **None** - Disable TTS
- **ElevenLabs** - High quality voices
- **Google Cloud** - Wide language support
- **Azure** - Microsoft's TTS service

### Whisper Model

For voice input during practice. Download once, works offline.

### Language Defaults

Set your default target and native languages for new conversations.

### Learning Settings

- **Required streak** - Correct answers needed to mark phrase as "learned"
- **Immediate retry** - Whether to retry wrong answers immediately
- **Default exercise mode** - Preferred practice mode (Manual/Typing/Speaking)

---

## Tips for Effective Learning

1. **Practice daily** - Even 5-10 minutes helps. SRS works best with consistent review.

2. **Trust the algorithm** - Don't skip ahead or review phrases before they're due. The spacing is designed to maximize retention.

3. **Be honest** - In manual mode, grade yourself accurately. Marking wrong answers as correct hurts your learning.

4. **Use conversations** - Don't just add phrases manually. Conversations help you discover natural expressions.

5. **Review context** - When a phrase is hard to remember, use AI Assistant to understand it better or add notes.

6. **Start small** - Begin with 10-20 phrases. Add more as you master the initial set.

7. **Use voice** - Speaking practice improves pronunciation and builds confidence for real conversations.
