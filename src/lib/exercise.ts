import { invoke } from "@tauri-apps/api/core";
import type { CheckAnswerResult } from "../types";

export async function checkExerciseAnswer(
  userAnswer: string,
  expectedAnswer: string,
  accepted: string[],
  fuzzy: boolean
): Promise<CheckAnswerResult> {
  return invoke<CheckAnswerResult>("check_exercise_answer", {
    userAnswer,
    expectedAnswer,
    accepted,
    fuzzy,
  });
}

export async function saveExerciseSession(
  date: string,
  phrasesCompleted: number,
  phrasesTotal: number
): Promise<void> {
  return invoke("save_exercise_session", { date, phrasesCompleted, phrasesTotal });
}

export async function getExerciseCalendar(): Promise<string[]> {
  return invoke<string[]>("get_exercise_calendar");
}
