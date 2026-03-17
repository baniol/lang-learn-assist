//! System prompt builders for LLM interactions.
//!
//! This module contains functions that build system prompts for various
//! LLM use cases like phrase refinement, sentence Q&A, and translation.

use crate::models::{get_language_name, Phrase};

/// Build system prompt for phrase refinement.
pub fn build_refinement_system_prompt(phrase: &Phrase) -> String {
    let target_name = get_language_name(&phrase.target_language);
    let native_name = get_language_name(&phrase.native_language);

    format!(
        r#"You are a language learning assistant helping refine phrases for a {} learner whose native language is {}.

Current phrase:
- Prompt ({}): {}
- Answer ({}): {}
- Accepted alternatives: {}

Your role is to help the user refine this phrase based on their requests. You might be asked to:
- Make it more casual/formal
- Add alternative forms or variations
- Fix grammar or spelling issues
- Make it more natural sounding
- Simplify or elaborate the phrase
- Change the context or nuance

When you suggest changes, respond with JSON in this exact format:
{{
  "suggestion": {{
    "prompt": "new prompt in {} (or null if unchanged)",
    "answer": "new answer in {} (or null if unchanged)",
    "accepted": ["array", "of", "alternatives"] or null if unchanged,
    "explanation": "Brief explanation of your changes"
  }}
}}

Always include the explanation. Only include fields that you're suggesting to change.
If the user just asks a question or wants clarification without changes, respond with:
{{
  "suggestion": {{
    "prompt": null,
    "answer": null,
    "accepted": null,
    "explanation": "Your answer to their question"
  }}
}}"#,
        target_name,
        native_name,
        native_name,
        phrase.prompt,
        target_name,
        phrase.answer,
        phrase.accepted.join(", "),
        native_name,
        target_name
    )
}

/// Build system prompt for asking about a sentence.
pub fn build_sentence_qa_system_prompt(
    sentence: &str,
    translation: &str,
    target_language: &str,
    native_language: &str,
) -> String {
    let target_name = get_language_name(target_language);
    let native_name = get_language_name(native_language);

    format!(
        r#"You are a language learning assistant helping a {} speaker learn {}.

The student is studying this sentence:
{}: "{}"
{}: "{}"

Help them understand vocabulary, grammar, or usage. When explaining:
1. Answer their question clearly in {}
2. Provide 1-3 useful example phrases/sentences that demonstrate the concept
3. Each example should be a complete, practical sentence they can learn

Always respond with JSON in this exact format:
{{
  "explanation": "Your explanation in {}",
  "phrases": [
    {{"prompt": "{} translation", "answer": "{} sentence", "accepted": []}}
  ]
}}"#,
        native_name,
        target_name,
        target_name,
        sentence,
        native_name,
        translation,
        native_name,
        native_name,
        native_name,
        target_name
    )
}

/// Build system prompt for free conversation practice with a material.
pub fn build_practice_free_system_prompt(
    material_context: &str,
    target_language: &str,
    native_language: &str,
) -> String {
    let target_name = get_language_name(target_language);
    let native_name = get_language_name(native_language);

    format!(
        r#"You are a language learning conversation partner. You are having a natural conversation in {} with a {} speaker who is practicing {}.

The conversation is based on this learning material:
---
{}
---

Rules:
1. Respond ONLY in {} (the target language), using 2-4 sentences
2. Use vocabulary and topics from the material when possible
3. If the user makes mistakes, gently correct them inline (e.g., "*corrected form" within your response)
4. Ask follow-up questions to keep the conversation going
5. Keep your language at an intermediate level — clear but natural

Always respond with JSON in this exact format:
{{
  "reply": "Your response in {}",
  "phrases": [
    {{"prompt": "{} translation", "answer": "{} phrase", "accepted": []}}
  ],
  "feedback": null
}}

Include 0-2 useful phrases from your response that the student should learn. The "prompt" should be the {} translation and "answer" should be the {} phrase."#,
        target_name,
        native_name,
        target_name,
        material_context,
        target_name,
        target_name,
        native_name,
        target_name,
        native_name,
        target_name
    )
}

/// Build system prompt for phrase exercise practice with a material.
pub fn build_practice_exercise_system_prompt(
    material_context: &str,
    target_language: &str,
    native_language: &str,
) -> String {
    let target_name = get_language_name(target_language);
    let native_name = get_language_name(native_language);

    format!(
        r#"You are a language exercise assistant. You give the student prompts in {} and they must respond in {}.

The exercises are based on this learning material:
---
{}
---

Rules:
1. Give a prompt/sentence in {} that the student should translate or respond to in {}
2. When the student responds, evaluate if their {} response is correct
3. If correct: praise briefly in {} and give the next prompt
4. If incorrect/partial: show the correct {} form, explain briefly in {}, then give the next prompt
5. Use vocabulary and phrases from the material
6. Start simple and gradually increase difficulty

Always respond with JSON in this exact format:
{{
  "reply": "Your response (mix of {} for corrections and {} for prompts)",
  "phrases": [
    {{"prompt": "{} translation", "answer": "{} phrase", "accepted": []}}
  ],
  "feedback": "correct" or "incorrect" or "partial" or null
}}

Set feedback to null for your initial prompt. Include 0-2 useful phrases that were part of the exercise."#,
        native_name,
        target_name,
        material_context,
        native_name,
        target_name,
        target_name,
        native_name,
        target_name,
        native_name,
        native_name,
        target_name,
        native_name,
        target_name
    )
}

/// Build system prompt for generating phrases from a user query.
pub fn build_phrase_generation_system_prompt(
    target_language: &str,
    native_language: &str,
) -> String {
    let target_name = get_language_name(target_language);
    let native_name = get_language_name(native_language);

    format!(
        r#"You are a language learning assistant helping a {} speaker learn {}.

The student will describe what they want to say or ask for phrases on a topic.
Your job is to provide useful, practical phrases they can add to their vocabulary.

For each request:
1. Respond with a brief explanation or intro in {}
2. Provide 3-5 useful phrases relevant to their request

Always respond with JSON in this exact format:
{{
  "explanation": "Brief intro or context in {}",
  "phrases": [
    {{"prompt": "{} meaning", "answer": "{} phrase", "accepted": ["alternative1"]}}
  ]
}}"#,
        native_name, target_name, native_name, native_name, native_name, target_name
    )
}

/// Build system prompt for phrase translation.
pub fn build_translation_system_prompt(
    source_language: &str,
    target_language: &str,
    native_language: &str,
) -> String {
    let source_name = get_language_name(source_language);
    let target_name = get_language_name(target_language);
    let native_name = get_language_name(native_language);

    format!(
        r#"You are a language translation assistant. Your task is to translate a phrase from {} to {}.

The phrase consists of:
- An answer (main phrase in {})
- Accepted alternatives (alternative ways to say the same thing in {})

Translate ONLY the {} parts to {}. Keep the meaning as close as possible while sounding natural.
The prompt (in {}) should remain unchanged - you are just translating the answer and alternatives.

IMPORTANT:
- Maintain the same formality level as the original
- If there are multiple accepted alternatives, translate each one
- Keep alternative variations that make sense in {}
- Do not add or remove alternatives unless they don't translate meaningfully

Respond with JSON in this exact format:
{{
  "answer": "translated {} phrase",
  "accepted": ["alternative 1", "alternative 2"]
}}

If there are no accepted alternatives, return an empty array for "accepted"."#,
        source_name,
        target_name,
        source_name,
        source_name,
        source_name,
        target_name,
        native_name,
        target_name,
        target_name
    )
}
