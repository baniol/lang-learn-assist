import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { createMaterial, processMaterial, estimateMaterialTokens } from "../lib/materials";
import { Button } from "../components/ui";
import { ChevronLeftIcon } from "../components/icons";
import { useSettings } from "../contexts/SettingsContext";
import type { ViewType, TokenEstimate, MaterialProcessingProgress } from "../types";

interface MaterialCreateViewProps {
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function MaterialCreateView({ onNavigate }: MaterialCreateViewProps) {
  const { settings } = useSettings();
  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenEstimate, setTokenEstimate] = useState<TokenEstimate | null>(null);
  const [progress, setProgress] = useState<MaterialProcessingProgress | null>(null);

  // Debounced token estimation
  useEffect(() => {
    if (!originalText.trim()) {
      setTokenEstimate(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const estimate = await estimateMaterialTokens(originalText.trim(), "text");
        setTokenEstimate(estimate);
      } catch (err) {
        console.error("Failed to estimate tokens:", err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [originalText]);

  // Listen for progress events
  useEffect(() => {
    const unlisten = listen<MaterialProcessingProgress>("material-processing-progress", (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleSubmit = async () => {
    if (!originalText.trim()) {
      setError("Please paste some content to process.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }

    setError(null);
    setIsProcessing(true);
    setProgress(null);

    try {
      const material = await createMaterial({
        title: title.trim(),
        materialType: "text",
        originalText: originalText.trim(),
        targetLanguage: settings?.targetLanguage,
        nativeLanguage: settings?.nativeLanguage,
      });

      await processMaterial(
        material.id,
        "text",
        originalText.trim(),
        settings?.targetLanguage || "de",
        settings?.nativeLanguage || "pl"
      );

      onNavigate("material-review", { materialId: material.id });
    } catch (err) {
      console.error("Failed to create material:", err);
      setError(
        err instanceof Error ? err.message : "Failed to process material. Please try again."
      );
      setIsProcessing(false);
      setProgress(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <Button onClick={() => onNavigate("materials")} variant="ghost" size="sm">
            <ChevronLeftIcon size="sm" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Add Material</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this material"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Content textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Text Content
            </label>
            <textarea
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder="Paste the article or text here..."
              rows={12}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          {/* Token Estimate */}
          {tokenEstimate && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-800 dark:text-white">
                    ~{tokenEstimate.estimatedTokens.toLocaleString()}
                  </span>{" "}
                  tokens
                  {tokenEstimate.chunkCount > 1 && (
                    <span className="ml-2">({tokenEstimate.chunkCount} chunks)</span>
                  )}
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  ~${tokenEstimate.estimatedCostUsd.toFixed(3)} USD
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isProcessing && progress && progress.totalChunks > 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>
                  Processing chunk {progress.currentChunk} of {progress.totalChunks}
                </span>
                <span>{Math.round(progress.percent)}%</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4">
            <Button onClick={() => onNavigate("materials")} disabled={isProcessing} variant="ghost">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !title.trim() || !originalText.trim()}
              isLoading={isProcessing}
            >
              {isProcessing ? "Processing..." : "Process & Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
