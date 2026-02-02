import { useState, useEffect, useCallback } from "react";
import { getMaterials, deleteMaterial } from "../lib/materials";
import type { ViewType, Material, MaterialType, AppSettings } from "../types";

interface MaterialsViewProps {
  onNavigate: (view: ViewType, data?: unknown) => void;
  settings: AppSettings | null;
}

export function MaterialsView({ onNavigate, settings }: MaterialsViewProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<MaterialType | "all">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadMaterials = useCallback(async () => {
    try {
      const data = await getMaterials(
        settings?.targetLanguage,
        typeFilter === "all" ? undefined : typeFilter
      );
      setMaterials(data);
    } catch (err) {
      console.error("Failed to load materials:", err);
    } finally {
      setIsLoading(false);
    }
  }, [settings?.targetLanguage, typeFilter]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleDelete = async (id: number) => {
    try {
      await deleteMaterial(id);
      setMaterials(materials.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete material:", err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "Z");
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Ready
          </span>
        );
      case "processing":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse">
            Processing
          </span>
        );
      case "error":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Error
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400">
            Pending
          </span>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === "transcript") {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Materials
          </h1>
          <button
            onClick={() => onNavigate("material-create")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Material
          </button>
        </div>

        {/* Type Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === "all"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter("transcript")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === "transcript"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            Transcripts
          </button>
          <button
            onClick={() => setTypeFilter("text")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === "text"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            Text
          </button>
        </div>
      </div>

      {/* Materials List */}
      <div className="flex-1 overflow-y-auto p-6">
        {materials.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">
              No materials yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Import YouTube transcripts or articles to analyze and learn from.
            </p>
            <button
              onClick={() => onNavigate("material-create")}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Add your first material
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {materials.map((material) => (
              <div
                key={material.id}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="text-slate-400 dark:text-slate-500 mt-0.5">
                      {getTypeIcon(material.materialType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-800 dark:text-white truncate">
                        {material.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                          {material.materialType}
                        </span>
                        {getStatusBadge(material.status)}
                        <span className="text-sm text-slate-400 dark:text-slate-500">
                          {formatDate(material.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {material.status === "ready" && (
                      <button
                        onClick={() => onNavigate("material-review", { materialId: material.id })}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm transition-colors"
                      >
                        Review
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(material.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Delete Material?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to delete this material? Phrases created from it will be kept.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
