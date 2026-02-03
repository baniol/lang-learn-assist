import { useState } from "react";
import { Button, Dialog } from "../ui";
import type { CreatePhraseRequest } from "../../types";

interface AddPhraseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (request: CreatePhraseRequest) => void;
}

export function AddPhraseDialog({
  isOpen,
  onClose,
  onAdd,
}: AddPhraseDialogProps) {
  const [newPhrase, setNewPhrase] = useState<CreatePhraseRequest>({
    prompt: "",
    answer: "",
    accepted: [],
    notes: "",
  });

  const handleClose = () => {
    onClose();
    setNewPhrase({ prompt: "", answer: "", accepted: [], notes: "" });
  };

  const handleAdd = () => {
    if (!newPhrase.prompt.trim() || !newPhrase.answer.trim()) return;
    onAdd(newPhrase);
    handleClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Add New Phrase">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Prompt (Polish)
          </label>
          <input
            type="text"
            value={newPhrase.prompt}
            onChange={(e) =>
              setNewPhrase({ ...newPhrase, prompt: e.target.value })
            }
            placeholder="What do you want to say..."
            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Answer (German)
          </label>
          <input
            type="text"
            value={newPhrase.answer}
            onChange={(e) =>
              setNewPhrase({ ...newPhrase, answer: e.target.value })
            }
            placeholder="The German translation..."
            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Accepted Alternatives (comma-separated)
          </label>
          <input
            type="text"
            value={newPhrase.accepted?.join(", ") || ""}
            onChange={(e) =>
              setNewPhrase({
                ...newPhrase,
                accepted: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="variant1, variant2..."
            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={newPhrase.notes || ""}
            onChange={(e) =>
              setNewPhrase({ ...newPhrase, notes: e.target.value })
            }
            placeholder="Any helpful notes..."
            rows={2}
            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button onClick={handleClose} variant="ghost">
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!newPhrase.prompt.trim() || !newPhrase.answer.trim()}
          >
            Add Phrase
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
