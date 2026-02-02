import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Layout } from "./components/Layout";
import { DashboardView } from "./views/DashboardView";
import { ConversationView } from "./views/ConversationView";
import { ConversationReviewView } from "./views/ConversationReviewView";
import { PhraseLibraryView } from "./views/PhraseLibraryView";
import { LearnView } from "./views/LearnView";
import { StatsView } from "./views/StatsView";
import { QuestionsView } from "./views/QuestionsView";
import { SettingsView } from "./views/SettingsView";
import { NotesView } from "./views/NotesView";
import { QuickNotePopup } from "./components/QuickNotePopup";
import type { ViewType, AppSettings } from "./types";

interface ViewState {
  type: ViewType;
  data?: Record<string, unknown>;
}

function App() {
  const [viewState, setViewState] = useState<ViewState>({ type: "dashboard" });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await invoke<AppSettings>("get_settings");
        setSettings(data);
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    loadSettings();
  }, []);

  const handleNavigate = useCallback((view: ViewType, data?: unknown) => {
    setViewState({ type: view, data: data as Record<string, unknown> | undefined });
  }, []);

  const renderView = () => {
    switch (viewState.type) {
      case "dashboard":
        return <DashboardView onNavigate={handleNavigate} settings={settings} />;
      case "conversation":
        return (
          <ConversationView
            conversationId={viewState.data?.conversationId as number}
            onNavigate={handleNavigate}
          />
        );
      case "conversation-review":
        return (
          <ConversationReviewView
            conversationId={viewState.data?.conversationId as number}
            onNavigate={handleNavigate}
          />
        );
      case "phrase-library":
        return <PhraseLibraryView settings={settings} />;
      case "learn":
        return <LearnView settings={settings} />;
      case "stats":
        return <StatsView settings={settings} />;
      case "questions":
        return <QuestionsView settings={settings} />;
      case "settings":
        return <SettingsView onSettingsChange={setSettings} />;
      case "notes":
        return <NotesView />;
      default:
        return <DashboardView onNavigate={handleNavigate} settings={settings} />;
    }
  };

  return (
    <>
      <Layout
        currentView={viewState.type}
        onNavigate={handleNavigate}
        settings={settings}
        onSettingsChange={setSettings}
        onQuickNoteOpen={() => setIsQuickNoteOpen(true)}
      >
        {renderView()}
      </Layout>
      <QuickNotePopup
        isOpen={isQuickNoteOpen}
        onClose={() => setIsQuickNoteOpen(false)}
      />
    </>
  );
}

export default App;
