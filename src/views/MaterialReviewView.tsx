import { useState, useEffect, useCallback } from "react";
import { getMaterial, getMaterialThreadIndices } from "../lib/materials";
import { SentenceThreadDialog } from "../components/SentenceThreadDialog";
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

  const loadMaterial = useCallback(async () => {
    try {
      const [data, indices] = await Promise.all([
        getMaterial(materialId),
        getMaterialThreadIndices(materialId),
      ]);
      setMaterial(data);
      setThreadDates(new Map(indices));
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400">Material not found</p>
          <button
            onClick={() => onNavigate("materials")}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Back to Materials
          </button>
        </div>
      </div>
    );
  }

  const segments: TextSegment[] = material.segmentsJson
    ? JSON.parse(material.segmentsJson)
    : [];

  const selectedSegment = selectedIndex !== null ? segments[selectedIndex] : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("materials")}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              {material.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {segments.length} sentences - Click the bulb to ask about any sentence
            </p>
          </div>
        </div>
      </div>

      {/* Sentences */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {segments.map((segment, index) => {
            const hasThread = threadDates.has(index);
            return (
              <div key={index} className="flex items-start p-4 gap-4 bg-white dark:bg-slate-800">
                {/* Ask AI Button */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <button
                    onClick={() => setSelectedIndex(index)}
                    className={`p-2 rounded-lg transition-colors ${
                      hasThread
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-amber-500"
                    }`}
                    title="Ask about this sentence"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </button>
                  {segment.timestamp && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {segment.timestamp}
                    </span>
                  )}
                </div>

                {/* Original & Translation */}
                <div className="flex-1 grid grid-cols-2 gap-6">
                  <div className="text-slate-800 dark:text-white">
                    {segment.text}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    {segment.translation}
                  </div>
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
