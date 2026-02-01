import { invoke } from "@tauri-apps/api/core";
import type { QuestionThread, GrammarQuestionResponse } from "../types";

export async function getQuestionThreads(targetLanguage?: string): Promise<QuestionThread[]> {
  return invoke<QuestionThread[]>("get_question_threads", {
    targetLanguage: targetLanguage || null,
  });
}

export async function getQuestionThread(id: number): Promise<QuestionThread> {
  return invoke<QuestionThread>("get_question_thread", { id });
}

export async function createQuestionThread(
  title: string,
  targetLanguage?: string,
  nativeLanguage?: string
): Promise<QuestionThread> {
  return invoke<QuestionThread>("create_question_thread", {
    title,
    targetLanguage,
    nativeLanguage,
  });
}

export async function deleteQuestionThread(id: number): Promise<void> {
  return invoke<void>("delete_question_thread", { id });
}

export async function askGrammarQuestion(
  threadId: number,
  question: string
): Promise<GrammarQuestionResponse> {
  return invoke<GrammarQuestionResponse>("ask_grammar_question", {
    threadId,
    question,
  });
}
