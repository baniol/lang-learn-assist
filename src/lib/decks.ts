import { invoke } from "@tauri-apps/api/core";
import type {
  Deck,
  DeckWithStats,
  CreateDeckRequest,
  UpdateDeckRequest,
  PhraseWithProgress,
} from "../types";

export async function getDecks(
  targetLanguage?: string
): Promise<DeckWithStats[]> {
  return invoke<DeckWithStats[]>("get_decks", { targetLanguage });
}

export async function getDeck(deckId: number): Promise<Deck> {
  return invoke<Deck>("get_deck", { deckId });
}

export async function createDeck(request: CreateDeckRequest): Promise<Deck> {
  return invoke<Deck>("create_deck", { request });
}

export async function updateDeck(
  deckId: number,
  request: UpdateDeckRequest
): Promise<Deck> {
  return invoke<Deck>("update_deck", { deckId, request });
}

export async function deleteDeck(deckId: number): Promise<void> {
  return invoke("delete_deck", { deckId });
}

export async function assignPhraseToDeck(
  phraseId: number,
  deckId: number | null
): Promise<void> {
  return invoke("assign_phrase_to_deck", { phraseId, deckId });
}

export async function assignPhrasesToDeck(
  phraseIds: number[],
  deckId: number | null
): Promise<void> {
  return invoke("assign_phrases_to_deck", { phraseIds, deckId });
}

export async function getDeckPhrases(
  deckId: number
): Promise<PhraseWithProgress[]> {
  return invoke<PhraseWithProgress[]>("get_deck_phrases", { deckId });
}
