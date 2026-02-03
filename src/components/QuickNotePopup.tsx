import { useState, useEffect, useRef, useCallback } from "react";
import { createNote } from "../lib/notes";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { CloseIcon, MicrophoneOutlineIcon } from "./icons";

interface QuickNotePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteCreated?: () => void;
}

export function QuickNotePopup({ isOpen, onClose, onNoteCreated }: QuickNotePopupProps) {
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTranscription = useCallback((text: string) => {
    setContent((prev) => (prev ? prev + " " + text : text));
  }, []);

  const { status, isAvailable, startRecording, stopRecording } = useVoiceRecording({
    enabled: isOpen,
    onTranscription: handleTranscription,
    disableSpaceKey: false, // Enable space key for recording when not in textarea
  });

  const isRecording = status === "recording";
  const isTranscribing = status === "transcribing";

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Reset content when closed
  useEffect(() => {
    if (!isOpen) {
      setContent("");
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Cmd/Ctrl + Enter to save
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, content, onClose]);

  const handleSave = async () => {
    if (!content.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await createNote({ content: content.trim() });
      onNoteCreated?.();
      onClose();
    } catch (err) {
      console.error("Failed to create note:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            Quick Note
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <CloseIcon size="md" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note..."
            className="w-full h-40 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Voice recording indicator */}
          {isAvailable && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                disabled={isTranscribing}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                  ${isRecording
                    ? "bg-red-500 text-white"
                    : isTranscribing
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-500"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }
                `}
              >
                {isRecording ? (
                  <>
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-sm">Recording...</span>
                  </>
                ) : isTranscribing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Transcribing...</span>
                  </>
                ) : (
                  <>
                    <MicrophoneOutlineIcon size="sm" />
                    <span className="text-sm">Hold to record</span>
                  </>
                )}
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                or press Space outside the text area
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to save
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
