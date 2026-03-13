import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type {
  ExportData,
  ImportMode,
  ImportResult,
  RemoveDuplicatesResult,
} from "../types";

export async function exportData(): Promise<ExportData> {
  return invoke<ExportData>("export_data");
}

export async function importData(
  data: ExportData,
  mode: ImportMode
): Promise<ImportResult> {
  return invoke<ImportResult>("import_data", { data, mode });
}

export async function exportToFile(): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await exportData();
    const json = JSON.stringify(data, null, 2);

    const defaultName = `lang-learn-export-${new Date().toISOString().split("T")[0]}.json`;

    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: "JSON", extensions: ["json"] }],
      title: "Export data",
    });

    if (!filePath) {
      return { success: false, error: "Export cancelled" };
    }

    await writeTextFile(filePath, json);

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function readFileAsJson(file: File): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as ExportData;
        // Basic validation
        if (!data.version || !data.exportedAt) {
          reject(new Error("Invalid export file format"));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(new Error("Failed to parse JSON file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export async function findDuplicatePhrases(): Promise<RemoveDuplicatesResult> {
  return invoke<RemoveDuplicatesResult>("find_duplicate_phrases");
}

export async function removeDuplicatePhrases(): Promise<RemoveDuplicatesResult> {
  return invoke<RemoveDuplicatesResult>("remove_duplicate_phrases");
}
