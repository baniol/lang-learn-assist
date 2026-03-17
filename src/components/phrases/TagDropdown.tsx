import { useState, useEffect, useRef, useCallback } from "react";
import { TagIcon, PlusIcon, CloseIcon } from "../icons";
import { cn } from "../../lib/utils";
import { getTags, createTag, deleteTag } from "../../api";
import type { Tag } from "../../types";

interface TagDropdownProps {
  selectedTagId: number | null;
  onTagSelect: (tagId: number | null) => void;
}

export function TagDropdown({ selectedTagId, onTagSelect }: TagDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadTags = useCallback(async () => {
    try {
      const data = await getTags();
      setTags(data);
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setDeleteConfirmId(null);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    try {
      await createTag(trimmed);
      setNewTagName("");
      await loadTags();
    } catch (err) {
      console.error("Failed to create tag:", err);
    }
  };

  const handleDeleteTag = async (id: number) => {
    try {
      await deleteTag(id);
      if (selectedTagId === id) {
        onTagSelect(null);
      }
      setDeleteConfirmId(null);
      await loadTags();
    } catch (err) {
      console.error("Failed to delete tag:", err);
    }
  };

  const selectedTag = tags.find((t) => t.id === selectedTagId);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
          selectedTagId
            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        )}
      >
        <TagIcon size="sm" />
        {selectedTag ? selectedTag.name : "Tags"}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
          {/* All (clear filter) */}
          <button
            onClick={() => {
              onTagSelect(null);
              setIsOpen(false);
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors",
              selectedTagId === null
                ? "font-medium text-blue-600 dark:text-blue-400"
                : "text-slate-700 dark:text-slate-200"
            )}
          >
            All phrases
          </button>

          {tags.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center group"
                >
                  <button
                    onClick={() => {
                      onTagSelect(tag.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex-1 text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors",
                      selectedTagId === tag.id
                        ? "font-medium text-blue-600 dark:text-blue-400"
                        : "text-slate-700 dark:text-slate-200"
                    )}
                  >
                    {tag.name}
                  </button>
                  {deleteConfirmId === tag.id ? (
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(tag.id)}
                      className="p-1 mr-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete tag"
                    >
                      <CloseIcon size="xs" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Create new tag */}
          <div className="border-t border-slate-200 dark:border-slate-700 p-2">
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateTag();
                }}
                placeholder="New tag..."
                className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400"
              />
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="p-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-colors"
              >
                <PlusIcon size="sm" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
