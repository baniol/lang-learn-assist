import { useState } from "react";
import { getMaterials, deleteMaterial } from "../lib/materials";
import { Button, Spinner, Badge, ConfirmDialog } from "../components/ui";
import { EmptyState } from "../components/shared";
import { PlusIcon, TrashIcon, ArchiveIcon, NoteIcon } from "../components/icons";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { useQuery, useMutation } from "../hooks";
import type { ViewType, MaterialType } from "../types";

interface MaterialsViewProps {
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function MaterialsView({ onNavigate }: MaterialsViewProps) {
  const { settings } = useSettings();
  const toast = useToast();
  const [typeFilter, setTypeFilter] = useState<MaterialType | "all">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Fetch materials
  const {
    data: materials,
    isLoading,
    refetch,
  } = useQuery(
    () => getMaterials(settings?.targetLanguage, typeFilter === "all" ? undefined : typeFilter),
    [settings?.targetLanguage, typeFilter],
    {
      onError: (err) => toast.error(`Failed to load materials: ${err.message}`),
    }
  );

  // Delete mutation
  const deleteMutation = useMutation((id: number) => deleteMaterial(id), {
    onSuccess: () => {
      setDeleteConfirm(null);
      refetch();
      toast.success("Material deleted");
    },
    onError: (err) => {
      setDeleteConfirm(null);
      toast.error(`Failed to delete material: ${err.message}`);
    },
  });

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
          <Badge variant="success" size="sm">
            Ready
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="info" size="sm" className="animate-pulse">
            Processing
          </Badge>
        );
      case "error":
        return (
          <Badge variant="error" size="sm">
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="default" size="sm">
            Pending
          </Badge>
        );
    }
  };

  const getTypeIcon = (_type: string) => {
    return <NoteIcon size="sm" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Materials</h1>
          <Button onClick={() => onNavigate("material-create")}>
            <PlusIcon size="sm" />
            Add Material
          </Button>
        </div>

        {/* Type Filter */}
        <div className="flex gap-2">
          {(["all", "text"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTypeFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === filter
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {filter === "all" ? "All" : "Text"}
            </button>
          ))}
        </div>
      </div>

      {/* Materials List */}
      <div className="flex-1 overflow-y-auto p-6">
        {!materials || materials.length === 0 ? (
          <EmptyState
            icon={<ArchiveIcon size="xl" className="text-slate-300 dark:text-slate-600" />}
            title="No materials yet"
            description="Import articles or record audio to analyze and learn from."
            action={{
              label: "Add your first material",
              onClick: () => onNavigate("material-create"),
            }}
          />
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
                      {material.status === "ready" ? (
                        <button
                          onClick={() =>
                            onNavigate("material-review", {
                              materialId: material.id,
                            })
                          }
                          className="font-medium text-slate-800 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                        >
                          {material.title}
                        </button>
                      ) : (
                        <h3 className="font-medium text-slate-800 dark:text-white truncate">
                          {material.title}
                        </h3>
                      )}
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
                    <Button
                      onClick={() => setDeleteConfirm(material.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                      title="Delete"
                    >
                      <TrashIcon size="sm" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm !== null && deleteMutation.mutate(deleteConfirm)}
        title="Delete Material?"
        message="Are you sure you want to delete this material? Phrases created from it will be kept."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}
