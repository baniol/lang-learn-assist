import { useState, useCallback } from "react";
import { Dialog, Button, Textarea } from "../ui";
import type { DeckImportData } from "../../types";

interface ImportDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DeckImportData) => void;
  isLoading?: boolean;
}

type ParseResult =
  | { success: true; data: DeckImportData }
  | { success: false; error: string };

function parseImportData(jsonText: string): ParseResult {
  if (!jsonText.trim()) {
    return { success: false, error: "Please paste the deck JSON" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { success: false, error: "Invalid JSON format" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { success: false, error: "JSON must be an object" };
  }

  const data = parsed as Record<string, unknown>;

  // Validate required fields
  if (typeof data.name !== "string" || !data.name.trim()) {
    return { success: false, error: "Missing required field: name" };
  }

  if (!Array.isArray(data.phrases)) {
    return { success: false, error: "Missing required field: phrases (must be an array)" };
  }

  if (data.phrases.length === 0) {
    return { success: false, error: "Deck must contain at least one phrase" };
  }

  // Validate each phrase
  for (let i = 0; i < data.phrases.length; i++) {
    const phrase = data.phrases[i];
    if (typeof phrase !== "object" || phrase === null) {
      return { success: false, error: `Phrase ${i + 1} must be an object` };
    }
    const p = phrase as Record<string, unknown>;
    if (typeof p.prompt !== "string" || !p.prompt.trim()) {
      return { success: false, error: `Phrase ${i + 1} is missing required field: prompt` };
    }
    if (typeof p.answer !== "string" || !p.answer.trim()) {
      return { success: false, error: `Phrase ${i + 1} is missing required field: answer` };
    }
  }

  // Build the import data with defaults
  const importData: DeckImportData = {
    name: data.name as string,
    description: typeof data.description === "string" ? data.description : undefined,
    targetLanguage: typeof data.targetLanguage === "string" ? data.targetLanguage : "de",
    nativeLanguage: typeof data.nativeLanguage === "string" ? data.nativeLanguage : "en",
    graduationThreshold: typeof data.graduationThreshold === "number" ? data.graduationThreshold : 2,
    level: typeof data.level === "string" ? data.level : undefined,
    category: typeof data.category === "string" ? data.category : undefined,
    phrases: data.phrases.map((p: Record<string, unknown>) => ({
      prompt: p.prompt as string,
      answer: p.answer as string,
      accepted: Array.isArray(p.accepted) ? p.accepted.filter((a): a is string => typeof a === "string") : [],
      notes: typeof p.notes === "string" ? p.notes : undefined,
    })),
  };

  return { success: true, data: importData };
}

export function ImportDeckDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: ImportDeckDialogProps) {
  const [jsonText, setJsonText] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);

    if (text.trim()) {
      setParseResult(parseImportData(text));
    } else {
      setParseResult(null);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (parseResult?.success) {
      onSubmit(parseResult.data);
    }
  }, [parseResult, onSubmit]);

  const handleClose = useCallback(() => {
    setJsonText("");
    setParseResult(null);
    onClose();
  }, [onClose]);

  const canSubmit = parseResult?.success && !isLoading;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Deck from JSON"
      size="lg"
      actions={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isLoading ? "Importing..." : "Import Deck"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Paste deck JSON
          </label>
          <Textarea
            value={jsonText}
            onChange={handleTextChange}
            placeholder={`{
  "name": "German B1 - Daily Conversations",
  "description": "Essential phrases for B1 level",
  "targetLanguage": "de",
  "nativeLanguage": "en",
  "graduationThreshold": 3,
  "level": "B1",
  "phrases": [
    {
      "prompt": "How do you say 'I would like to order'?",
      "answer": "Ich möchte bestellen",
      "accepted": ["Ich würde gerne bestellen"],
      "notes": "Common restaurant phrase"
    }
  ]
}`}
            rows={12}
            disabled={isLoading}
            className="font-mono text-sm"
          />
        </div>

        {/* Parse result feedback */}
        {parseResult && (
          <div className={`p-3 rounded-lg ${
            parseResult.success
              ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          }`}>
            {parseResult.success ? (
              <div className="text-green-700 dark:text-green-300">
                <div className="font-medium">Ready to import</div>
                <div className="text-sm mt-1">
                  <span className="font-medium">{parseResult.data.name}</span>
                  {parseResult.data.level && (
                    <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-800 rounded text-xs">
                      {parseResult.data.level}
                    </span>
                  )}
                </div>
                <div className="text-sm mt-1">
                  {parseResult.data.phrases.length} phrase{parseResult.data.phrases.length !== 1 ? "s" : ""}
                  {" "}&bull;{" "}
                  {parseResult.data.targetLanguage} &rarr; {parseResult.data.nativeLanguage}
                </div>
                {parseResult.data.description && (
                  <div className="text-sm mt-1 opacity-75">
                    {parseResult.data.description}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-700 dark:text-red-300">
                <div className="font-medium">Error</div>
                <div className="text-sm mt-1">{parseResult.error}</div>
              </div>
            )}
          </div>
        )}

        {/* Format guide */}
        <details className="text-sm text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
            JSON Format Guide
          </summary>
          <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
            <div>
              <span className="font-medium">Required fields:</span>
              <ul className="list-disc list-inside ml-2">
                <li><code>name</code> - deck name</li>
                <li><code>phrases</code> - array of phrases</li>
              </ul>
            </div>
            <div>
              <span className="font-medium">Optional deck fields:</span>
              <ul className="list-disc list-inside ml-2">
                <li><code>description</code> - deck description</li>
                <li><code>targetLanguage</code> - language code (default: "de")</li>
                <li><code>nativeLanguage</code> - language code (default: "en")</li>
                <li><code>graduationThreshold</code> - correct answers to graduate (default: 2)</li>
                <li><code>level</code> - e.g., "A1", "B1", "C1"</li>
                <li><code>category</code> - e.g., "conversation", "grammar"</li>
              </ul>
            </div>
            <div>
              <span className="font-medium">Phrase fields:</span>
              <ul className="list-disc list-inside ml-2">
                <li><code>prompt</code> - question/prompt (required)</li>
                <li><code>answer</code> - correct answer (required)</li>
                <li><code>accepted</code> - array of alternative accepted answers</li>
                <li><code>notes</code> - additional notes</li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </Dialog>
  );
}
