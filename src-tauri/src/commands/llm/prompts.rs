//! System prompt builders for LLM interactions.
//!
//! This module contains functions that build system prompts for various
//! LLM use cases like phrase refinement and sentence Q&A.

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
        native_name, target_name,
        target_name, sentence,
        native_name, translation,
        native_name,
        native_name,
        native_name, target_name
    )
}
