import { useState, useCallback } from "react";
import { Dialog, Button, Select, Input, Spinner } from "../ui";
import { ChevronRightIcon } from "../icons";
import {
  previewPhraseTranslation,
  applyPhraseTranslation,
} from "../../lib/phrases";
import type { Phrase, TranslationPreview } from "../../types";
import { LANGUAGE_OPTIONS } from "../../types";

interface TranslateDialogProps {
  isOpen: boolean;
  phrase: Phrase | null;
  onClose: () => void;
  onTranslated: (phrase: Phrase) => void;
}

export function TranslateDialog({
  isOpen,
  phrase,
  onClose,
  onTranslated,
}: TranslateDialogProps) {
  const [targetLanguage, setTargetLanguage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TranslationPreview | null>(null);

  // Editable fields for the translated content
  const [editedAnswer, setEditedAnswer] = useState("");
  const [editedAccepted, setEditedAccepted] = useState<string[]>([]);

  // Filter language options to exclude the current target language
  const availableLanguages = LANGUAGE_OPTIONS.filter(
    (lang) => lang.code !== phrase?.targetLanguage
  ).map((lang) => ({ value: lang.code, label: lang.name }));

  const handlePreview = useCallback(async () => {
    if (!phrase || !targetLanguage) return;

    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      const result = await previewPhraseTranslation(phrase.id, targetLanguage);
      setPreview(result);
      setEditedAnswer(result.translatedAnswer);
      setEditedAccepted(result.translatedAccepted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to translate");
    } finally {
      setIsLoading(false);
    }
  }, [phrase, targetLanguage]);

  const handleApply = useCallback(async () => {
    if (!phrase || !preview) return;

    setIsLoading(true);
    setError(null);

    try {
      const updatedPhrase = await applyPhraseTranslation(
        phrase.id,
        editedAnswer,
        editedAccepted,
        preview.newTargetLanguage
      );
      onTranslated(updatedPhrase);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply translation");
      setIsLoading(false);
    }
  }, [phrase, preview, editedAnswer, editedAccepted, onTranslated]);

  const handleClose = useCallback(() => {
    setTargetLanguage("");
    setPreview(null);
    setEditedAnswer("");
    setEditedAccepted([]);
    setError(null);
    setIsLoading(false);
    onClose();
  }, [onClose]);

  const handleAcceptedChange = useCallback((index: number, value: string) => {
    setEditedAccepted((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const handleRemoveAccepted = useCallback((index: number) => {
    setEditedAccepted((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddAccepted = useCallback(() => {
    setEditedAccepted((prev) => [...prev, ""]);
  }, []);

  if (!phrase) return null;

  const currentLangName =
    LANGUAGE_OPTIONS.find((l) => l.code === phrase.targetLanguage)?.name ||
    phrase.targetLanguage;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Copy Phrase to Another Language"
      size="lg"
      actions={
        preview ? (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApply}
              isLoading={isLoading}
            >
              Create Translated Copy
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        )
      }
    >
      <div className="space-y-6">
        {/* Current phrase info */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            Current ({currentLangName})
          </p>
          <p className="text-slate-800 dark:text-white font-medium">
            {phrase.answer}
          </p>
          {phrase.accepted.length > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Alternatives: {phrase.accepted.join(", ")}
            </p>
          )}
        </div>

        {/* Language selection */}
        {!preview && (
          <div className="space-y-4">
            <Select
              label="Translate to"
              options={availableLanguages}
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              placeholder="Select language..."
            />

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handlePreview}
                disabled={!targetLanguage}
                isLoading={isLoading}
              >
                Preview Translation
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !preview && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        )}

        {/* Translation preview with editable fields */}
        {preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{currentLangName}</span>
              <ChevronRightIcon size="xs" />
              <span>
                {LANGUAGE_OPTIONS.find((l) => l.code === preview.newTargetLanguage)?.name ||
                  preview.newTargetLanguage}
              </span>
            </div>

            {/* Answer comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Original
                </p>
                <p className="text-slate-800 dark:text-white">
                  {preview.originalAnswer}
                </p>
              </div>
              <div>
                <Input
                  label="Translated"
                  value={editedAnswer}
                  onChange={(e) => setEditedAnswer(e.target.value)}
                />
              </div>
            </div>

            {/* Accepted alternatives */}
            {(preview.originalAccepted.length > 0 || editedAccepted.length > 0) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Alternatives
                </p>

                {/* Show original alternatives */}
                {preview.originalAccepted.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Original alternatives
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {preview.originalAccepted.join(", ")}
                    </p>
                  </div>
                )}

                {/* Editable translated alternatives */}
                <div className="space-y-2">
                  {editedAccepted.map((alt, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={alt}
                        onChange={(e) => handleAcceptedChange(index, e.target.value)}
                        placeholder="Alternative translation..."
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAccepted(index)}
                        className="text-red-500 hover:text-red-600"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddAccepted}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    + Add alternative
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}

            <div className="text-sm text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              This will create a new phrase in the selected language. The
              original phrase will remain unchanged.
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
