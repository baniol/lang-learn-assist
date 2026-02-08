import { invoke } from "@tauri-apps/api/core";
import type {
  DeckImportMode,
  DeckPackImportResult,
  DeckPackValidation,
  DeckSource,
} from "../types";

/**
 * Validate a deck pack JSON without importing.
 */
export async function validateDeckPack(
  jsonContent: string
): Promise<DeckPackValidation> {
  return invoke<DeckPackValidation>("validate_deck_pack", { jsonContent });
}

/**
 * Import a deck pack from JSON content.
 */
export async function importDeckPack(
  jsonContent: string,
  importMode: DeckImportMode
): Promise<DeckPackImportResult> {
  return invoke<DeckPackImportResult>("import_deck_pack", {
    jsonContent,
    importMode,
  });
}

/**
 * Get the deck source for a specific deck.
 */
export async function getDeckSource(
  deckId: number
): Promise<DeckSource | null> {
  return invoke<DeckSource | null>("get_deck_source", { deckId });
}
