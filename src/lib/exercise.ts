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
