# Language Learning Assistant - User Guide

A desktop application for practicing foreign language conversations with AI assistance, building a personal phrase library, and processing learning materials with voice input and text-to-speech.

---

## Table of Contents

1. [Overview](#overview)
2. [Conversations](#conversations)
3. [Phrase Library](#phrase-library)
4. [Materials](#materials)
5. [Voice Features](#voice-features)
6. [Settings](#settings)

---

## Overview

The app helps you learn a foreign language through three main activities:

1. **Conversations** - Have AI-powered translation conversations to discover how to say things in your target language
2. **Phrase Library** - Build a personal collection of phrases to learn
3. **Materials** - Import and process learning materials to extract phrases

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
- **Filter** by status
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

## Materials

Import and process learning materials (articles, texts, etc.) to extract useful phrases.

### Adding Materials

1. Go to the Materials view
2. Create a new material with your text content
3. The AI processes the text and extracts useful phrases
4. Review extracted phrases and add them to your library

---

## Voice Features

### Text-to-Speech (TTS)

Listen to correct pronunciation of phrases. Supported providers:
- ElevenLabs
- Google Cloud
- Azure

Configure in Settings with your API key and preferred voice.

### Speech-to-Text (Whisper)

Transcribe spoken input automatically.

**Setup:**
1. Go to Settings
2. Download a Whisper model (Base recommended for balance of speed/accuracy)
3. Wait for download to complete

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

For voice input. Download once, works offline.

### Language Defaults

Set your default target and native languages for new conversations.

---

## Tips for Effective Learning

1. **Use conversations** - Don't just add phrases manually. Conversations help you discover natural expressions.

2. **Review context** - When a phrase is hard to remember, use AI Assistant to understand it better or add notes.

3. **Start small** - Begin with 10-20 phrases. Add more as you master the initial set.

4. **Use materials** - Import articles or texts in your target language to discover new phrases in context.
