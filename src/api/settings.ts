/**
 * Settings API - Application configuration
 */
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types";

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function testLlmConnection(): Promise<string> {
  return invoke<string>("test_llm_connection");
}
