import { useState, useCallback } from "react";
import { Layout } from "./components/Layout";
import { DashboardView } from "./views/DashboardView";
import { ConversationView } from "./views/ConversationView";
import { ConversationReviewView } from "./views/ConversationReviewView";
import { PhraseLibraryView } from "./views/PhraseLibraryView";
import { LearnView } from "./views/LearnView";
import { SettingsView } from "./views/SettingsView";
import type { ViewType } from "./types";

interface ViewState {
  type: ViewType;
  data?: Record<string, unknown>;
}

function App() {
  const [viewState, setViewState] = useState<ViewState>({ type: "dashboard" });

  const handleNavigate = useCallback((view: ViewType, data?: unknown) => {
    setViewState({ type: view, data: data as Record<string, unknown> | undefined });
  }, []);

  const renderView = () => {
    switch (viewState.type) {
      case "dashboard":
        return <DashboardView onNavigate={handleNavigate} />;
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
        return <PhraseLibraryView />;
      case "learn":
        return <LearnView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentView={viewState.type} onNavigate={handleNavigate}>
      {renderView()}
    </Layout>
  );
}

export default App;
