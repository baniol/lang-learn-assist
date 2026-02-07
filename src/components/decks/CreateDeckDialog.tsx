import { useState } from "react";
import { Dialog, Button, Input, Textarea } from "../ui";
import type { CreateDeckRequest } from "../../types";

interface CreateDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: CreateDeckRequest) => void;
  isLoading?: boolean;
  defaultTargetLanguage?: string;
  defaultNativeLanguage?: string;
}

export function CreateDeckDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  defaultTargetLanguage = "de",
  defaultNativeLanguage = "pl",
}: CreateDeckDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [graduationThreshold, setGraduationThreshold] = useState(2);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      targetLanguage: defaultTargetLanguage,
      nativeLanguage: defaultNativeLanguage,
      graduationThreshold,
    });
    // Reset form - the parent will close the dialog on success
    setName("");
    setDescription("");
    setGraduationThreshold(2);
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setGraduationThreshold(2);
    setError(null);
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
            {isLoading ? "Creating..." : "Create Deck"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Restaurant Vocabulary"
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
                setGraduationThreshold(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-24"
              disabled={isLoading}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              correct answers to graduate to SRS
            </span>
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
      </form>
    </Dialog>
  );
}
