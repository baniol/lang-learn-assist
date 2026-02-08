import { useState } from "react";
import { Dialog, Button, Input, Textarea, Select } from "../ui";
import type {
  CreateDeckRequest,
  GenerateDeckRequest,
  CefrLevel,
} from "../../types";
import { CEFR_LEVELS, VOCABULARY_CATEGORIES } from "../../types";
import { SparklesIcon } from "../icons";

type CreationMode = "manual" | "ai";

interface CreateDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: CreateDeckRequest) => void;
  onGenerate?: (request: GenerateDeckRequest) => void;
  isLoading?: boolean;
  defaultTargetLanguage?: string;
  defaultNativeLanguage?: string;
}

export function CreateDeckDialog({
  isOpen,
  onClose,
  onSubmit,
  onGenerate,
  isLoading = false,
  defaultTargetLanguage = "de",
  defaultNativeLanguage = "pl",
}: CreateDeckDialogProps) {
  const [mode, setMode] = useState<CreationMode>("manual");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [graduationThreshold, setGraduationThreshold] = useState(2);
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [category, setCategory] = useState("");
  const [phraseCount, setPhraseCount] = useState(20);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (mode === "manual") {
      onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        targetLanguage: defaultTargetLanguage,
        nativeLanguage: defaultNativeLanguage,
        graduationThreshold,
      });
    } else if (onGenerate) {
      onGenerate({
        name: name.trim(),
        description: description.trim() || undefined,
        level,
        category: category || undefined,
        phraseCount,
        targetLanguage: defaultTargetLanguage,
        nativeLanguage: defaultNativeLanguage,
      });
    }
    // Reset form - the parent will close the dialog on success
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setGraduationThreshold(2);
    setLevel("B1");
    setCategory("");
    setPhraseCount(20);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    setMode("manual");
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Deck"
      actions={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
            {isLoading
              ? mode === "ai"
                ? "Generating..."
                : "Creating..."
              : mode === "ai"
                ? "Generate Deck"
                : "Create Deck"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode Switcher */}
        {onGenerate && (
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === "manual"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setMode("ai")}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                mode === "ai"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <SparklesIcon size="sm" />
              AI Generate
            </button>
          </div>
        )}

        {/* Common Fields */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              mode === "ai"
                ? "e.g., German B1 Travel Vocabulary"
                : "e.g., Restaurant Vocabulary"
            }
            disabled={isLoading}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Description (optional)
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this deck for?"
            rows={2}
            disabled={isLoading}
          />
        </div>

        {/* Manual Mode Fields */}
        {mode === "manual" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Graduation Threshold
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={10}
                value={graduationThreshold}
                onChange={(e) =>
                  setGraduationThreshold(
                    Math.max(1, parseInt(e.target.value) || 1)
                  )
                }
                className="w-24"
                disabled={isLoading}
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                correct answers to graduate to SRS
              </span>
            </div>
          </div>
        )}

        {/* AI Mode Fields */}
        {mode === "ai" && (
          <>
            <div>
              <Select
                label="CEFR Level"
                value={level}
                onChange={(e) => setLevel(e.target.value as CefrLevel)}
                disabled={isLoading}
                options={CEFR_LEVELS.map((l) => ({
                  value: l.level,
                  label: `${l.level} - ${l.description}`,
                }))}
              />
            </div>

            <div>
              <Select
                label="Category (optional)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isLoading}
                options={[
                  { value: "", label: "General vocabulary" },
                  ...VOCABULARY_CATEGORIES.map((c) => ({
                    value: c.id,
                    label: `${c.icon} ${c.label}`,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Number of Phrases
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={phraseCount}
                  onChange={(e) => setPhraseCount(parseInt(e.target.value))}
                  className="flex-1"
                  disabled={isLoading}
                />
                <span className="w-12 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                  {phraseCount}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm rounded-lg p-3">
              AI will generate {phraseCount} phrases at {level} level
              {category && ` about ${VOCABULARY_CATEGORIES.find((c) => c.id === category)?.label.toLowerCase()}`}
              . This requires a configured LLM API key.
            </div>
          </>
        )}

        {error && <div className="text-red-500 text-sm">{error}</div>}
      </form>
    </Dialog>
  );
}
