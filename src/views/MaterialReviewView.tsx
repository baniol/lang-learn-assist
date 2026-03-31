import { useState, useEffect, useCallback, useRef } from "react";
import { getMaterial, getMaterialThreadIndices, updateMaterialBookmark } from "../lib/materials";
import { playAudioFile } from "../lib/audio";
import { SentenceThreadDialog } from "../components/SentenceThreadDialog";
import { Button, Spinner } from "../components/ui";
import { ChevronLeftIcon, LightbulbIcon, BookmarkIcon, VolumeUpIcon } from "../components/icons";
import type { ViewType, Material, TextSegment } from "../types";

interface MaterialReviewViewProps {
  materialId: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function MaterialReviewView({ materialId, onNavigate }: MaterialReviewViewProps) {
  const [material, setMaterial] = useState<Material | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [threadDates, setThreadDates] = useState<Map<number, string>>(new Map());
  const [bookmarkIndex, setBookmarkIndex] = useState<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const sentenceRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const loadMaterial = useCallback(async () => {
    try {
      const [data, indices] = await Promise.all([
        getMaterial(materialId),
        getMaterialThreadIndices(materialId),
      ]);
      setMaterial(data);
      setThreadDates(new Map(indices));
      setBookmarkIndex(data.bookmarkIndex);
    } catch (err) {
      console.error("Failed to load material:", err);
    } finally {
      setIsLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    loadMaterial();
  }, [loadMaterial]);

  const handleDialogClose = () => {
    // Refresh thread indices when dialog closes
    getMaterialThreadIndices(materialId)
      .then((indices) => setThreadDates(new Map(indices)))
      .catch(console.error);
    setSelectedIndex(null);
  };

  const handleToggleBookmark = useCallback(
    async (index: number) => {
      const newBookmarkIndex = bookmarkIndex === index ? null : index;
      setBookmarkIndex(newBookmarkIndex);
      try {
        await updateMaterialBookmark(materialId, newBookmarkIndex);
      } catch (err) {
        console.error("Failed to update bookmark:", err);
        // Revert on error
        setBookmarkIndex(bookmarkIndex);
      }
    },
    [materialId, bookmarkIndex]
  );

  const scrollToBookmark = useCallback(() => {
    if (bookmarkIndex !== null) {
      const element = sentenceRefs.current.get(bookmarkIndex);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [bookmarkIndex]);

  const handlePlayAudio = useCallback(
    async (index: number, audioPath: string) => {
      if (playingIndex === index) return;

      setPlayingIndex(index);
      try {
        await playAudioFile(audioPath);
      } catch (err) {
        console.error("Failed to play audio:", err);
      } finally {
        setPlayingIndex(null);
      }
    },
    [playingIndex]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400">Material not found</p>
          <Button onClick={() => onNavigate("materials")} className="mt-4">
            Back to Materials
          </Button>
        </div>
      </div>
    );
  }

  const segments: TextSegment[] = material.segmentsJson ? JSON.parse(material.segmentsJson) : [];

  const selectedSegment =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < segments.length
      ? segments[selectedIndex]
      : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <Button onClick={() => onNavigate("materials")} variant="ghost" size="sm">
            <ChevronLeftIcon size="sm" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">{material.title}</h1>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{segments.length} sentences - Click the bulb to ask about any sentence</span>
            </div>
          </div>
          <button
            onClick={scrollToBookmark}
            disabled={bookmarkIndex === null}
            className={`p-2 rounded-lg transition-colors ${
              bookmarkIndex !== null
                ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
            }`}
            title={bookmarkIndex !== null ? "Go to bookmark" : "No bookmark set"}
          >
            <BookmarkIcon size="md" filled={bookmarkIndex !== null} />
          </button>
        </div>
      </div>

      {/* Sentences */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {segments.map((segment, index) => {
            const hasThread = threadDates.has(index);
            const isBookmarked = bookmarkIndex === index;
            return (
              <div
                key={index}
                ref={(el) => {
                  if (el) sentenceRefs.current.set(index, el);
                  else sentenceRefs.current.delete(index);
                }}
                className={`flex items-start p-4 gap-4 ${
                  isBookmarked ? "bg-blue-50 dark:bg-blue-900/20" : "bg-white dark:bg-slate-800"
                }`}
              >
                {/* Action buttons */}
                <div className="flex flex-col items-center flex-shrink-0 gap-1">
                  <button
                    onClick={() => setSelectedIndex(index)}
                    className={`p-2 rounded-lg transition-colors ${
                      hasThread
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-amber-500"
                    }`}
                    title="Ask about this sentence"
                  >
                    <LightbulbIcon size="sm" />
                  </button>
                  <button
                    onClick={() => handleToggleBookmark(index)}
                    className={`p-2 rounded-lg transition-colors ${
                      isBookmarked
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-500 dark:text-slate-600"
                    }`}
                    title={isBookmarked ? "Remove bookmark" : "Set bookmark"}
                  >
                    <BookmarkIcon size="sm" filled={isBookmarked} />
                  </button>
                  {segment.audioPath && (
                    <button
                      onClick={() => handlePlayAudio(index, segment.audioPath!)}
                      disabled={playingIndex === index}
                      className={`p-2 rounded-lg transition-colors ${
                        playingIndex === index
                          ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                          : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-green-500"
                      }`}
                      title="Play audio"
                    >
                      <VolumeUpIcon size="sm" />
                    </button>
                  )}
                  {segment.timestamp && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {segment.timestamp}
                    </span>
                  )}
                </div>

                {/* Original & Translation */}
                <div className="flex-1 grid grid-cols-2 gap-6">
                  <div className="text-slate-800 dark:text-white">{segment.text}</div>
                  <div className="text-slate-500 dark:text-slate-400">{segment.translation}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialog */}
      {selectedSegment && selectedIndex !== null && (
        <SentenceThreadDialog
          material={material}
          segment={selectedSegment}
          segmentIndex={selectedIndex}
          onClose={handleDialogClose}
        />
      )}
    </div>
  );
}
