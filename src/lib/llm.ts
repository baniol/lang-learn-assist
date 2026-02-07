import { invoke } from "@tauri-apps/api/core";

export async function testLlmConnection(): Promise<string> {
  return invoke<string>("test_llm_connection");
}

export async function generateTitle(
  content: string,
  contentType: "conversation" | "question",
  nativeLanguage?: string
): Promise<string> {
  return invoke<string>("generate_title", {
    content,
    contentType,
    nativeLanguage: nativeLanguage ?? null,
  });
}
