/**
 * Tags API - CRUD and phrase-tag associations
 */
import { invoke } from "@tauri-apps/api/core";
import type { Tag } from "../types";

export async function getTags(targetLanguage: string): Promise<Tag[]> {
  return invoke<Tag[]>("get_tags", { targetLanguage });
}

export async function createTag(name: string, targetLanguage: string): Promise<Tag> {
  return invoke<Tag>("create_tag", { name, targetLanguage });
}

export async function deleteTag(id: number): Promise<void> {
  return invoke("delete_tag", { id });
}

export async function addTagToPhrase(phraseId: number, tagId: number): Promise<void> {
  return invoke("add_tag_to_phrase", { phraseId, tagId });
}

export async function removeTagFromPhrase(phraseId: number, tagId: number): Promise<void> {
  return invoke("remove_tag_from_phrase", { phraseId, tagId });
}

export async function getPhraseTags(phraseId: number): Promise<Tag[]> {
  return invoke<Tag[]>("get_phrase_tags", { phraseId });
}
