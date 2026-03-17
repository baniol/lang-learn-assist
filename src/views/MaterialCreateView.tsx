import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  startRecording as micStart,
  stopRecording as micStop,
} from "tauri-plugin-mic-recorder-api";
import {
  createMaterial,
  processMaterial,
  processAudioSegments,
  estimateMaterialTokens,
  AudioSegmentInput,
} from "../lib/materials";
import {
  initWhisper,
  isWhisperReady,
  isModelDownloaded,
  transcribeAndPreserveAudio,
  TranscriptionWithAudio,
} from "../lib/audio";
import { Button, Spinner } from "../components/ui";
import {
  ChevronLeftIcon,
  NoteIcon,
  MicrophoneIcon,
  TrashIcon,
  StopIcon,
} from "../components/icons";
import { useSettings } from "../contexts/SettingsContext";
import type { ViewType, MaterialType, TokenEstimate, MaterialProcessingProgress } from "../types";

interface AudioSegment {
  text: string;
  audioPath: string;
}

type RecordingStatus = "idle" | "recording" | "transcribing";

interface MaterialCreateViewProps {
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function MaterialCreateView({ onNavigate }: MaterialCreateViewProps) {
  const { settings } = useSettings();
  const [materialType, setMaterialType] = useState<MaterialType>("text");
  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenEstimate, setTokenEstimate] = useState<TokenEstimate | null>(null);
  const [progress, setProgress] = useState<MaterialProcessingProgress | null>(null);

  // Audio recording state
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [isWhisperAvailable, setIsWhisperAvailable] = useState(false);
  const whisperInitialized = useRef(false);

  // Check if Whisper model is available for audio recording
  useEffect(() => {
    const checkWhisperAvailability = async () => {
      try {
        const available = await isModelDownloaded();
        setIsWhisperAvailable(available);
      } catch {
        setIsWhisperAvailable(false);
      }
    };

    if (materialType === "audio") {
      checkWhisperAvailability();
    }
  }, [materialType]);

  // Initialize Whisper when first needed
  const ensureWhisperReady = useCallback(async () => {
    if (whisperInitialized.current) {
      return true;
    }

    try {
      const ready = await isWhisperReady();
      if (ready) {
        whisperInitialized.current = true;
        return true;
      }

      await initWhisper();
      whisperInitialized.current = true;
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      return false;
    }
  }, []);

  // Start recording
  const handleStartRecording = useCallback(async () => {
    if (recordingStatus !== "idle") return;

    const ready = await ensureWhisperReady();
    if (!ready) return;

    try {
      setError(null);
      setRecordingStatus("recording");
      await micStart();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setRecordingStatus("idle");
    }
  }, [recordingStatus, ensureWhisperReady]);

  // Stop recording and transcribe
  const handleStopRecording = useCallback(async () => {
    if (recordingStatus !== "recording") return;

    try {
      setRecordingStatus("transcribing");
      const audioPath = await micStop();

      if (!audioPath) {
        setRecordingStatus("idle");
        return;
      }

      // Transcribe and preserve the audio
      const result: TranscriptionWithAudio = await transcribeAndPreserveAudio(
        audioPath,
        settings?.targetLanguage
      );

      if (result.transcription && result.transcription.trim()) {
        setAudioSegments((prev) => [
          ...prev,
          {
            text: result.transcription.trim(),
            audioPath: result.savedAudioPath,
          },
        ]);
      }

      setRecordingStatus("idle");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setRecordingStatus("idle");
    }
  }, [recordingStatus, settings?.targetLanguage]);

  // Delete audio segment
  const handleDeleteSegment = useCallback((index: number) => {
    setAudioSegments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Debounced token estimation (only for text-based materials)
  useEffect(() => {
    if (materialType === "audio" || !originalText.trim()) {
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
    // Validation
    if (materialType === "audio") {
      if (audioSegments.length === 0) {
        setError("Please record at least one audio segment.");
        return;
      }
    } else {
      if (!originalText.trim()) {
        setError("Please paste some content to process.");
        return;
      }
    }

    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }

    setError(null);
    setIsProcessing(true);
    setProgress(null);

    try {
      // For audio materials, use transcriptions as original text
      const textForMaterial =
        materialType === "audio"
          ? audioSegments.map((s) => s.text).join("\n")
          : originalText.trim();

      // Create the material
      const material = await createMaterial({
        title: title.trim(),
        materialType,
        originalText: textForMaterial,
        targetLanguage: settings?.targetLanguage,
        nativeLanguage: settings?.nativeLanguage,
      });

      // Process based on type
      if (materialType === "audio") {
        // For audio, use the special audio segments processing
        const segments: AudioSegmentInput[] = audioSegments.map((s) => ({
          text: s.text,
          audioPath: s.audioPath,
        }));

        await processAudioSegments(
          material.id,
          segments,
          settings?.targetLanguage || "de",
          settings?.nativeLanguage || "pl"
        );
      } else {
        // For transcript/text, use existing processing
        await processMaterial(
          material.id,
          materialType,
          originalText.trim(),
          settings?.targetLanguage || "de",
          settings?.nativeLanguage || "pl"
        );
      }

      // Navigate to review
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

  // Clear audio segments when switching away from audio type
  useEffect(() => {
    if (materialType !== "audio") {
      setAudioSegments([]);
    }
  }, [materialType]);

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
          {/* Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Material Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setMaterialType("text")}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  materialType === "text"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <NoteIcon size="lg" />
                <div className="text-left">
                  <div className="font-medium">Article / Text</div>
                  <div className="text-xs opacity-75">Sentence-by-sentence translation</div>
                </div>
              </button>
              <button
                onClick={() => setMaterialType("audio")}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  materialType === "audio"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <MicrophoneIcon size="lg" />
                <div className="text-left">
                  <div className="font-medium">Voice Recording</div>
                  <div className="text-xs opacity-75">Record and transcribe audio</div>
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

          {/* Audio Recording UI */}
          {materialType === "audio" && (
            <div className="space-y-4">
              {/* Whisper availability warning */}
              {!isWhisperAvailable && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400">
                  <p className="font-medium">Whisper model not downloaded</p>
                  <p className="text-sm mt-1">
                    Go to Settings to download a Whisper model before recording.
                  </p>
                </div>
              )}

              {/* Recording button */}
              <div className="flex flex-col items-center gap-4 py-6">
                {recordingStatus === "idle" && (
                  <button
                    onClick={handleStartRecording}
                    disabled={!isWhisperAvailable || isProcessing}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white flex items-center justify-center transition-colors shadow-lg"
                    title="Start recording"
                  >
                    <MicrophoneIcon size="lg" />
                  </button>
                )}

                {recordingStatus === "recording" && (
                  <button
                    onClick={handleStopRecording}
                    className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors shadow-lg animate-pulse"
                    title="Stop recording"
                  >
                    <StopIcon size="lg" />
                  </button>
                )}

                {recordingStatus === "transcribing" && (
                  <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    <Spinner size="lg" />
                  </div>
                )}

                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {recordingStatus === "idle" && "Click to start recording a segment"}
                  {recordingStatus === "recording" && "Recording... Click to stop"}
                  {recordingStatus === "transcribing" && "Transcribing..."}
                </p>
              </div>

              {/* Recorded segments list */}
              {audioSegments.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Recorded Segments ({audioSegments.length})
                  </label>
                  <div className="space-y-2">
                    {audioSegments.map((segment, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center justify-center">
                          {index + 1}
                        </span>
                        <p className="flex-1 text-slate-800 dark:text-white text-sm">
                          {segment.text}
                        </p>
                        <button
                          onClick={() => handleDeleteSegment(index)}
                          className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title="Delete segment"
                        >
                          <TrashIcon size="sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Record multiple short segments. Each will be transcribed and translated separately.
              </p>
            </div>
          )}

          {/* Content textarea (for text type) */}
          {materialType !== "audio" && (
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
          )}

          {/* Token Estimate (for text-based materials) */}
          {tokenEstimate && materialType !== "audio" && (
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
              disabled={
                isProcessing ||
                !title.trim() ||
                (materialType === "audio" ? audioSegments.length === 0 : !originalText.trim())
              }
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
