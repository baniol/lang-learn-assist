import { useState, useCallback } from "react";
import { Dialog, AIChatPanel, Button, Input } from "../ui";
import type { ChatMessage } from "../ui";
import { CheckIcon, CloseIcon } from "../icons";
import { generatePhrases } from "../../lib/phrases";
import { createPhrase } from "../../api";
import { useSettings } from "../../contexts/SettingsContext";
import type { SuggestedPhrase } from "../../types";

type Mode = "ai" | "manual";

interface AddPhraseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddPhraseDialog({ isOpen, onClose, onAdded }: AddPhraseDialogProps) {
  const { settings } = useSettings();
  const [mode, setMode] = useState<Mode>("ai");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingPhrases, setPendingPhrases] = useState<SuggestedPhrase[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [manualPrompt, setManualPrompt] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);

  const handleClose = () => {
    setMessages([]);
    setInputValue("");
    setPendingPhrases([]);
    setError(null);
    setManualPrompt("");
    setManualAnswer("");
    onClose();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    const query = inputValue.trim();
    setInputValue("");
    setIsSending(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    try {
      const response = await generatePhrases(
        query,
        messages.map(({ role, content }) => ({ role, content })),
        settings?.targetLanguage,
        settings?.nativeLanguage
      );

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.explanation,
      };
      setMessages([...updatedMessages, assistantMessage]);
      setPendingPhrases((prev) => [...prev, ...response.phrases]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages(messages);
    } finally {
      setIsSending(false);
    }
  };

  const handleAccept = async (phrase: SuggestedPhrase, index: number) => {
    try {
      await createPhrase({
        prompt: phrase.prompt,
        answer: phrase.answer,
        accepted: phrase.accepted || [],
        targetLanguage: settings?.targetLanguage,
        nativeLanguage: settings?.nativeLanguage,
      });
      setPendingPhrases((prev) => prev.filter((_, i) => i !== index));
      onAdded();
    } catch (err) {
      setError(`Failed to save phrase: ${err}`);
    }
  };

  const handleReject = (index: number) => {
    setPendingPhrases((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveManual = useCallback(async () => {
    const prompt = manualPrompt.trim();
    const answer = manualAnswer.trim();
    if (!prompt || !answer) return;

    setIsSavingManual(true);
    setError(null);
    try {
      await createPhrase({
        prompt,
        answer,
        targetLanguage: settings?.targetLanguage,
        nativeLanguage: settings?.nativeLanguage,
      });
      setManualPrompt("");
      setManualAnswer("");
      onAdded();
    } catch (err) {
      setError(`Failed to save phrase: ${err}`);
    } finally {
      setIsSavingManual(false);
    }
  }, [manualPrompt, manualAnswer, settings, onAdded]);

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Add Phrases">
      <div className="flex flex-col -mx-6 -mb-6" style={{ minHeight: 360 }}>
        {/* Mode tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
          <button
            onClick={() => setMode("ai")}
            className={`py-2 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === "ai"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            AI
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`py-2 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === "manual"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Ręcznie
          </button>
        </div>

        {/* Manual mode */}
        {mode === "manual" && (
          <div className="flex flex-col gap-4 px-6 py-5 flex-1">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Zdanie źródłowe ({settings?.nativeLanguage ?? "native"})
              </label>
              <Input
                value={manualPrompt}
                onChange={(e) => setManualPrompt(e.target.value)}
                placeholder="np. How do I get to the train station?"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Zdanie docelowe ({settings?.targetLanguage ?? "target"})
              </label>
              <Input
                value={manualAnswer}
                onChange={(e) => setManualAnswer(e.target.value)}
                placeholder="np. Wie komme ich zum Bahnhof?"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) handleSaveManual();
                }}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveManual}
                disabled={!manualPrompt.trim() || !manualAnswer.trim() || isSavingManual}
                variant="primary"
              >
                {isSavingManual ? "Zapisywanie..." : "Dodaj frazę"}
              </Button>
            </div>
          </div>
        )}

        {/* AI mode */}
        {mode === "ai" && pendingPhrases.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Suggested Phrases ({pendingPhrases.length})
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {pendingPhrases.map((phrase, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-white truncate">
                      {phrase.answer}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {phrase.prompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(phrase, i)}
                      className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                      title="Add to phrases"
                    >
                      <CheckIcon size="sm" />
                    </button>
                    <button
                      onClick={() => handleReject(i)}
                      className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Dismiss"
                    >
                      <CloseIcon size="sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        {mode === "ai" && (
          <>
            <AIChatPanel
              messages={messages}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSend={handleSend}
              isSending={isSending}
              placeholder="Describe what you want to say, e.g. 'how to ask for directions'..."
              variant="blue"
              className="flex-1"
            />

            {error && (
              <div className="px-6 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
