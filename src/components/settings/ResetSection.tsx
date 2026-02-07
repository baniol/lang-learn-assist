import { useState } from "react";
import { SettingsSection } from "./SettingsSection";
import { Button, ConfirmDialog } from "../ui";
import { TrashIcon } from "../icons";

interface ResetSectionProps {
  onResetSessions: () => Promise<number>;
  onResetProgress: () => Promise<number>;
}

export function ResetSection({
  onResetSessions,
  onResetProgress,
}: ResetSectionProps) {
  const [isResettingSessions, setIsResettingSessions] = useState(false);
  const [isResettingProgress, setIsResettingProgress] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "sessions" | "progress";
    isOpen: boolean;
  }>({ type: "sessions", isOpen: false });
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleResetSessions = async () => {
    setIsResettingSessions(true);
    setResult(null);
    try {
      const count = await onResetSessions();
      setResult({
        type: "success",
        message: `Cleared ${count} practice sessions`,
      });
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to reset sessions",
      });
    } finally {
      setIsResettingSessions(false);
      setConfirmDialog({ type: "sessions", isOpen: false });
    }
  };

  const handleResetProgress = async () => {
    setIsResettingProgress(true);
    setResult(null);
    try {
      const count = await onResetProgress();
      setResult({
        type: "success",
        message: `Reset progress for ${count} phrases`,
      });
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to reset progress",
      });
    } finally {
      setIsResettingProgress(false);
      setConfirmDialog({ type: "progress", isOpen: false });
    }
  };

  return (
    <SettingsSection title="Reset Data">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Reset learning statistics and progress. Your phrases and decks will be kept.
        </p>

        <div className="space-y-3">
          {/* Reset Sessions */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Practice Sessions
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Clear session history (stats page)
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDialog({ type: "sessions", isOpen: true })}
              disabled={isResettingSessions}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <TrashIcon size="sm" className="mr-1" />
              Clear
            </Button>
          </div>

          {/* Reset Progress */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Learning Progress
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reset all phrase progress, SRS data, and deck graduation
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDialog({ type: "progress", isOpen: true })}
              disabled={isResettingProgress}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <TrashIcon size="sm" className="mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`p-3 rounded-lg text-sm ${
              result.type === "success"
                ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            }`}
          >
            {result.message}
          </div>
        )}

        {/* Confirm Dialogs */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen && confirmDialog.type === "sessions"}
          title="Clear Practice Sessions?"
          message="This will delete all session history. Your phrases and learning progress will not be affected."
          confirmLabel="Clear Sessions"
          onConfirm={handleResetSessions}
          onClose={() => setConfirmDialog({ type: "sessions", isOpen: false })}
          isLoading={isResettingSessions}
        />

        <ConfirmDialog
          isOpen={confirmDialog.isOpen && confirmDialog.type === "progress"}
          title="Reset All Learning Progress?"
          message="This will reset all phrase progress including streaks, attempts, SRS intervals, and deck graduation. All phrases will need to be learned again from scratch. Your phrases and decks will be kept."
          confirmLabel="Reset Progress"
          onConfirm={handleResetProgress}
          onClose={() => setConfirmDialog({ type: "progress", isOpen: false })}
          isLoading={isResettingProgress}
          variant="danger"
        />
      </div>
    </SettingsSection>
  );
}
