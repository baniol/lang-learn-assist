import { invoke } from "@tauri-apps/api/core";
import type { GenerateDeckRequest, GenerateDeckResponse } from "../types";

/**
 * Generate a new deck with AI-generated phrases.
 */
export async function generateDeck(
  request: GenerateDeckRequest
): Promise<GenerateDeckResponse> {
  return invoke<GenerateDeckResponse>("generate_deck", { request });
}

/**
 * Extend an existing deck with more AI-generated phrases.
 */
export async function extendDeck(
  deckId: number,
  phraseCount: number
): Promise<number> {
  return invoke<number>("extend_deck", { deckId, phraseCount });
}
