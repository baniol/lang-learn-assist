import { useState, useCallback } from "react";
import { Dialog, Button, Select } from "../ui";
import { UploadIcon, CheckCircleIcon, WarningIcon } from "../icons";
import { validateDeckPack, importDeckPack } from "../../lib/deck-import";
import type {
  DeckImportMode,
  DeckPackValidation,
  DeckPackImportResult,
} from "../../types";

interface ImportDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: DeckPackImportResult) => void;
}

type ImportStep = "select" | "preview" | "importing" | "result";

export function ImportDeckDialog({
  isOpen,
  onClose,
  onSuccess,
}: ImportDeckDialogProps) {
  const [step, setStep] = useState<ImportStep>("select");
  const [jsonContent, setJsonContent] = useState<string>("");
  const [validation, setValidation] = useState<DeckPackValidation | null>(null);
  const [importMode, setImportMode] = useState<DeckImportMode>("skip_existing");
  const [result, setResult] = useState<DeckPackImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reset = useCallback(() => {
    setStep("select");
    setJsonContent("");
    setValidation(null);
    setImportMode("skip_existing");
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setIsLoading(true);

      try {
        const content = await file.text();
        setJsonContent(content);

        const validationResult = await validateDeckPack(content);
        setValidation(validationResult);
        setStep("preview");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to read file"
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!jsonContent) return;

    setError(null);
    setIsLoading(true);
    setStep("importing");

    try {
      const importResult = await importDeckPack(jsonContent, importMode);
      setResult(importResult);
      setStep("result");

      if (importResult.success) {
        onSuccess(importResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  }, [jsonContent, importMode, onSuccess]);

  const renderSelectStep = () => (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
        <UploadIcon
          size="xl"
          className="mx-auto text-slate-400 dark:text-slate-500 mb-4"
        />
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Select a deck pack file (.json)
        </p>
        <label className="inline-block">
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isLoading}
          />
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
            <UploadIcon size="sm" />
            Choose File
          </span>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
        <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">
          Deck Pack Format
        </h4>
        <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-auto">
{`{
  "version": 1,
  "packName": "German A1 Essentials",
  "decks": [{
    "name": "Greetings",
    "level": "A1",
    "phrases": [
      {"prompt": "Hello", "answer": "Hallo"}
    ]
  }]
}`}
        </pre>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      {validation && (
        <>
          {/* Pack Info */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">
              {validation.packName}
            </h4>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p>
                {validation.deckCount} deck(s), {validation.phraseCount} phrase(s)
              </p>
            </div>
          </div>

          {/* Validation Status */}
          {validation.valid ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircleIcon size="sm" />
              <span className="text-sm">Pack is valid and ready to import</span>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                <WarningIcon size="sm" />
                <span className="text-sm font-medium">Validation errors:</span>
              </div>
              <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-2">
                <WarningIcon size="sm" />
                <span className="text-sm font-medium">Warnings:</span>
              </div>
              <ul className="text-sm text-yellow-600 dark:text-yellow-400 list-disc list-inside">
                {validation.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Import Mode */}
          {validation.valid && (
            <div>
              <Select
                label="Import Mode"
                value={importMode}
                onChange={(e) =>
                  setImportMode(e.target.value as DeckImportMode)
                }
                options={[
                  {
                    value: "skip_existing",
                    label: "Skip existing decks (won't create duplicates)",
                  },
                  {
                    value: "merge_into_existing",
                    label: "Merge into existing decks (add new phrases)",
                  },
                  {
                    value: "create_new",
                    label: "Always create new (may create duplicates)",
                  },
                ]}
              />
            </div>
          )}
        </>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );

  const renderImportingStep = () => (
    <div className="text-center py-8">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-slate-600 dark:text-slate-400">Importing decks...</p>
    </div>
  );

  const renderResultStep = () => (
    <div className="space-y-4">
      {result && (
        <>
          <div
            className={`flex items-center gap-2 ${
              result.success
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.success ? (
              <CheckCircleIcon size="md" />
            ) : (
              <WarningIcon size="md" />
            )}
            <span className="font-medium">{result.message}</span>
          </div>

          {result.success && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-500 dark:text-slate-400">
                  Decks created:
                </dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">
                  {result.decksCreated}
                </dd>
                {result.decksMerged > 0 && (
                  <>
                    <dt className="text-slate-500 dark:text-slate-400">
                      Decks merged:
                    </dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-300">
                      {result.decksMerged}
                    </dd>
                  </>
                )}
                <dt className="text-slate-500 dark:text-slate-400">
                  Phrases created:
                </dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">
                  {result.phrasesCreated}
                </dd>
                {result.phrasesSkipped > 0 && (
                  <>
                    <dt className="text-slate-500 dark:text-slate-400">
                      Phrases skipped:
                    </dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-300">
                      {result.phrasesSkipped}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case "select":
        return renderSelectStep();
      case "preview":
        return renderPreviewStep();
      case "importing":
        return renderImportingStep();
      case "result":
        return renderResultStep();
    }
  };

  const renderActions = () => {
    switch (step) {
      case "select":
        return (
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
        );
      case "preview":
        return (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!validation?.valid || isLoading}
            >
              Import
            </Button>
          </>
        );
      case "importing":
        return null;
      case "result":
        return (
          <Button onClick={handleClose}>
            {result?.success ? "Done" : "Close"}
          </Button>
        );
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={step === "importing" ? () => {} : handleClose}
      title="Import Deck Pack"
      actions={renderActions()}
    >
      {renderContent()}
    </Dialog>
  );
}
