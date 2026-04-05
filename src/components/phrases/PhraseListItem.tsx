import { useState, useEffect, useCallback, useRef } from "react";
import { StarIcon, TagIcon, CloseIcon, PlusIcon } from "../icons";
import { cn } from "../../lib/utils";
import { PhraseActions } from "./PhraseActions";
import { getPhraseTags, addTagToPhrase, removeTagFromPhrase, getTags } from "../../api";
import type { Phrase, Tag } from "../../types";

interface PhraseListItemProps {
  item: Phrase;
  isPlaying: boolean;
  isLoading: boolean;
  onToggleStar: (id: number) => void;
  onPlay: () => void;
  onRefine: () => void;
  onDelete: () => void;
}

export function PhraseListItem({
  item: phrase,
  isPlaying,
  isLoading,
  onToggleStar,
  onPlay,
  onRefine,
  onDelete,
}: PhraseListItemProps) {
  const [phraseTags, setPhraseTags] = useState<Tag[]>([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPhraseTags(phrase.id).then(setPhraseTags).catch(console.error);
  }, [phrase.id]);

  const openTagMenu = useCallback(async () => {
    try {
      const tags = await getTags(phrase.targetLanguage);
      setAllTags(tags);
      setShowTagMenu(true);
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  }, [phrase.targetLanguage]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowTagMenu(false);
      }
    }
    if (showTagMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTagMenu]);

  const handleAddTag = async (tagId: number) => {
    try {
      await addTagToPhrase(phrase.id, tagId);
      const updated = await getPhraseTags(phrase.id);
      setPhraseTags(updated);
    } catch (err) {
      console.error("Failed to add tag:", err);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      await removeTagFromPhrase(phrase.id, tagId);
      setPhraseTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch (err) {
      console.error("Failed to remove tag:", err);
    }
  };

  const phraseTagIds = new Set(phraseTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !phraseTagIds.has(t.id));

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
      {/* Star */}
      <button
        onClick={() => onToggleStar(phrase.id)}
        className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex-shrink-0 ${
          phrase.starred ? "text-yellow-500" : "text-slate-300 dark:text-slate-600"
        }`}
      >
        <StarIcon size="sm" filled={phrase.starred} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{phrase.prompt}</p>
        <p className="text-base font-medium text-slate-800 dark:text-white">{phrase.answer}</p>
        {/* Tags */}
        {phraseTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {phraseTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                {tag.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag.id);
                  }}
                  className="hover:text-red-500 transition-colors"
                >
                  <CloseIcon size="xs" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tag button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={openTagMenu}
          className={cn(
            "p-2 rounded transition-colors",
            phraseTags.length > 0
              ? "text-blue-500 dark:text-blue-400"
              : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          )}
          title="Manage tags"
        >
          <TagIcon size="xs" />
        </button>
        {showTagMenu && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
            {availableTags.length === 0 && phraseTags.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No tags yet</p>
            ) : (
              <>
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag.id)}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5"
                  >
                    <PlusIcon size="xs" className="text-slate-400" />
                    {tag.name}
                  </button>
                ))}
                {availableTags.length === 0 && (
                  <p className="px-3 py-1.5 text-xs text-slate-400">All tags assigned</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <PhraseActions
        isPlaying={isPlaying}
        isLoading={isLoading}
        isRefined={phrase.refined}
        onPlay={onPlay}
        onRefine={onRefine}
        onDelete={onDelete}
      />
    </div>
  );
}
