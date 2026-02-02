import { invoke } from "@tauri-apps/api/core";
import type { Note, CreateNoteRequest, UpdateNoteRequest } from "../types";

export async function getNotes(): Promise<Note[]> {
  return invoke<Note[]>("get_notes");
}

export async function getNote(id: number): Promise<Note> {
  return invoke<Note>("get_note", { id });
}

export async function createNote(request: CreateNoteRequest): Promise<Note> {
  return invoke<Note>("create_note", { request });
}

export async function updateNote(
  id: number,
  request: UpdateNoteRequest
): Promise<Note> {
  return invoke<Note>("update_note", { id, request });
}

export async function deleteNote(id: number): Promise<void> {
  return invoke<void>("delete_note", { id });
}
