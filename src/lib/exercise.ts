import { invoke } from "@tauri-apps/api/core";
import type { CheckAnswerResult, ExerciseSession } from "../types";

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
  phrasesTotal: number,
  targetLanguage: string
): Promise<void> {
  return invoke("save_exercise_session", { date, phrasesCompleted, phrasesTotal, targetLanguage });
}

export async function getExerciseCalendar(): Promise<string[]> {
  return invoke<string[]>("get_exercise_calendar");
}

export async function getExerciseDayDetails(date: string): Promise<ExerciseSession[]> {
  return invoke<ExerciseSession[]>("get_exercise_day_details", { date });
}

export async function getAllExerciseSessions(): Promise<ExerciseSession[]> {
  return invoke<ExerciseSession[]>("get_all_exercise_sessions");
}

export async function deleteExerciseSession(sessionId: number): Promise<void> {
  return invoke("delete_exercise_session", { sessionId });
}
