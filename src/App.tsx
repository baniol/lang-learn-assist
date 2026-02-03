import { useState, useCallback } from "react";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ErrorBoundary } from "./components/shared";
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
import { MaterialsView } from "./views/MaterialsView";
import { MaterialCreateView } from "./views/MaterialCreateView";
import { MaterialReviewView } from "./views/MaterialReviewView";
import { QuickNotePopup } from "./components/QuickNotePopup";
import { PageSpinner } from "./components/ui";
import type { ViewType } from "./types";

interface ViewState {
  type: ViewType;
  data?: Record<string, unknown>;
}

/**
 * Main application content.
 * Must be wrapped in SettingsProvider to access settings via context.
 */
function AppContent() {
  const { isLoading } = useSettings();
  const [viewState, setViewState] = useState<ViewState>({ type: "dashboard" });
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);

  const handleNavigate = useCallback((view: ViewType, data?: unknown) => {
    setViewState({
      type: view,
      data: data as Record<string, unknown> | undefined,
    });
  }, []);

  // Show loading spinner while settings are being fetched
  if (isLoading) {
    return (
      <div className="h-screen bg-slate-50 dark:bg-slate-900">
        <PageSpinner />
      </div>
    );
  }

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
      case "stats":
        return <StatsView />;
      case "questions":
        return <QuestionsView />;
      case "settings":
        return <SettingsView />;
      case "notes":
        return <NotesView />;
      case "materials":
        return <MaterialsView onNavigate={handleNavigate} />;
      case "material-create":
        return <MaterialCreateView onNavigate={handleNavigate} />;
      case "material-review":
        return (
          <MaterialReviewView
            materialId={viewState.data?.materialId as number}
            onNavigate={handleNavigate}
          />
        );
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <>
      <Layout
        currentView={viewState.type}
        onNavigate={handleNavigate}
        onQuickNoteOpen={() => setIsQuickNoteOpen(true)}
      >
        <ErrorBoundary
          onReset={() => setViewState({ type: "dashboard" })}
          onError={(error) => console.error("View error:", error)}
        >
          {renderView()}
        </ErrorBoundary>
      </Layout>
      <QuickNotePopup
        isOpen={isQuickNoteOpen}
        onClose={() => setIsQuickNoteOpen(false)}
      />
    </>
  );
}

/**
 * Root application component with providers.
 */
function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
