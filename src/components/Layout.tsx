import { useState, useRef, useEffect } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { cn } from "../lib/utils";
import {
  BookIcon,
  ArchiveIcon,
  QuestionCircleIcon,
  NoteIcon,
  SettingsIcon,
  PlusIcon,
  ChevronDownIcon,
  CheckIcon,
} from "./icons";
import type { ViewType } from "../types";
import { LANGUAGE_OPTIONS } from "../types";

// Flag emoji for each language
const LANGUAGE_FLAGS: Record<string, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
};

interface LayoutProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  children: React.ReactNode;
  onQuickNoteOpen?: () => void;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
}

const baseNavItems: NavItem[] = [
  { id: "phrase-library", label: "Phrases", icon: <BookIcon /> },
  { id: "materials", label: "Materials", icon: <ArchiveIcon /> },
  { id: "questions", label: "Questions", icon: <QuestionCircleIcon /> },
];

const notesNavItem: NavItem = {
  id: "notes",
  label: "Notes",
  icon: <NoteIcon />,
};

const settingsNavItem: NavItem = {
  id: "settings",
  label: "Settings",
  icon: <SettingsIcon />,
};

export function Layout({
  currentView,
  onNavigate,
  children,
  onQuickNoteOpen,
}: LayoutProps) {
  const { settings, updateSetting } = useSettings();
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Build nav items based on settings
  const navItems = [
    ...baseNavItems,
    ...(settings?.notesEnabled ? [notesNavItem] : []),
    settingsNavItem,
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setLanguageDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await updateSetting("targetLanguage", languageCode);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
    setLanguageDropdownOpen(false);
  };

  const currentLang = settings?.targetLanguage || "de";
  const currentLangOption = LANGUAGE_OPTIONS.find(
    (l) => l.code === currentLang,
  );
  const currentFlag = LANGUAGE_FLAGS[currentLang] || "🌐";

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Logo and Language Switcher */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Lang Learn
          </h1>
          {/* Language Switcher */}
          <div className="relative mt-2" ref={dropdownRef}>
            <button
              onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentFlag}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {currentLangOption?.name || "German"}
                </span>
              </div>
              <ChevronDownIcon
                size="sm"
                className={cn(
                  "text-slate-500 dark:text-slate-400 transition-transform",
                  languageDropdownOpen && "rotate-180",
                )}
              />
            </button>

            {/* Dropdown */}
            {languageDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-50 overflow-hidden">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors",
                      lang.code === currentLang
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "text-slate-700 dark:text-slate-200",
                    )}
                  >
                    <span className="text-lg">
                      {LANGUAGE_FLAGS[lang.code] || "🌐"}
                    </span>
                    <span className="text-sm font-medium">{lang.name}</span>
                    {lang.code === currentLang && (
                      <CheckIcon size="sm" className="ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              currentView === item.id ||
              (item.id === "materials" &&
                (currentView === "material-create" ||
                  currentView === "material-review"));

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50",
                )}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          {settings?.notesEnabled && onQuickNoteOpen && (
            <button
              onClick={onQuickNoteOpen}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            >
              <PlusIcon size="sm" />
              <span className="text-sm font-medium">Add a note</span>
            </button>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Press Space to record
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
