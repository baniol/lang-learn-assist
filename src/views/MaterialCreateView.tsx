import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { createMaterial, processMaterial, estimateMaterialTokens } from "../lib/materials";
import type { ViewType, MaterialType, AppSettings, TokenEstimate, MaterialProcessingProgress } from "../types";

interface MaterialCreateViewProps {
  onNavigate: (view: ViewType, data?: unknown) => void;
  settings: AppSettings | null;
}

export function MaterialCreateView({ onNavigate, settings }: MaterialCreateViewProps) {
  const [materialType, setMaterialType] = useState<MaterialType>("transcript");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
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
        const estimate = await estimateMaterialTokens(originalText.trim(), materialType);
        setTokenEstimate(estimate);
      } catch (err) {
        console.error("Failed to estimate tokens:", err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [originalText, materialType]);

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
      // Create the material
      const material = await createMaterial({
        title: title.trim(),
        materialType,
        sourceUrl: sourceUrl.trim() || undefined,
        originalText: originalText.trim(),
        targetLanguage: settings?.targetLanguage,
        nativeLanguage: settings?.nativeLanguage,
      });

      // Process it (parse + translate)
      await processMaterial(
        material.id,
        materialType,
        originalText.trim(),
        settings?.targetLanguage || "de",
        settings?.nativeLanguage || "pl"
      );

      // Navigate to review
      onNavigate("material-review", { materialId: material.id });
    } catch (err) {
      console.error("Failed to create material:", err);
      setError(err instanceof Error ? err.message : "Failed to process material. Please try again.");
      setIsProcessing(false);
      setProgress(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("materials")}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Add Material
          </h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Material Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setMaterialType("transcript")}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  materialType === "transcript"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-left">
                  <div className="font-medium">YouTube Transcript</div>
                  <div className="text-xs opacity-75">With timestamps and video embed</div>
                </div>
              </button>
              <button
                onClick={() => setMaterialType("text")}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  materialType === "text"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="text-left">
                  <div className="font-medium">Article / Text</div>
                  <div className="text-xs opacity-75">Sentence-by-sentence translation</div>
                </div>
              </button>
            </div>
          </div>

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

          {/* YouTube URL (for transcripts) */}
          {materialType === "transcript" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                YouTube URL (optional)
              </label>
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                If provided, the video will be embedded for click-to-seek playback.
              </p>
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {materialType === "transcript" ? "Transcript" : "Text Content"}
            </label>
            <textarea
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder={
                materialType === "transcript"
                  ? "Paste the YouTube transcript here...\n\nFormat:\n0:15 Hallo, wie geht's?\n0:18 Mir geht es gut.\n..."
                  : "Paste the article or text here..."
              }
              rows={12}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            {materialType === "transcript" && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Each line should start with a timestamp (e.g., "0:15 Text here")
              </p>
            )}
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
                    <span className="ml-2">
                      ({tokenEstimate.chunkCount} chunks)
                    </span>
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
                <span>Processing chunk {progress.currentChunk} of {progress.totalChunks}</span>
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
            <button
              onClick={() => onNavigate("materials")}
              disabled={isProcessing}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !originalText.trim() || !title.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Process & Continue
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
