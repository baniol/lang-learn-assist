import { useState } from "react";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ErrorBoundary } from "./components/shared";
import { Layout } from "./components/Layout";
import { PhraseLibraryView } from "./views/PhraseLibraryView";
import { StudyView } from "./views/StudyView";
import { StatsView } from "./views/StatsView";
import { QuestionsView } from "./views/QuestionsView";
import { SettingsView } from "./views/SettingsView";
import { NotesView } from "./views/NotesView";
import { MaterialsView } from "./views/MaterialsView";
import { MaterialCreateView } from "./views/MaterialCreateView";
import { MaterialReviewView } from "./views/MaterialReviewView";
import { DecksView } from "./views/DecksView";
import { DeckDetailView } from "./views/DeckDetailView";
import { QuickNotePopup } from "./components/QuickNotePopup";
import { PageSpinner } from "./components/ui";
import { useNavigation } from "./hooks";
import {
  isMaterialReviewView,
  isDeckDetailView,
  isDeckStudyView,
} from "./types/navigation";

/**
 * Main application content.
 * Must be wrapped in SettingsProvider to access settings via context.
 */
function AppContent() {
  const { isLoading } = useSettings();
  const { viewState, currentView, navigate } = useNavigation();
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);

  // Legacy-compatible navigate wrapper for views that haven't been updated yet
  // TODO: Remove once all views use the type-safe NavigateFn
  const legacyNavigate = (view: string, data?: unknown) => {
    if (data && typeof data === "object") {
      (navigate as (v: string, d: Record<string, unknown>) => void)(
        view,
        data as Record<string, unknown>
      );
    } else {
      (navigate as (v: string) => void)(view);
    }
  };

  // Show loading spinner while settings are being fetched
  if (isLoading) {
    return (
      <div className="h-screen bg-slate-50 dark:bg-slate-900">
        <PageSpinner />
      </div>
    );
  }

  const renderView = () => {
    // Type-safe view rendering using discriminated unions
    if (isMaterialReviewView(viewState)) {
      return (
        <MaterialReviewView
          materialId={viewState.materialId}
          onNavigate={legacyNavigate}
        />
      );
    }
    if (isDeckDetailView(viewState)) {
      return (
        <DeckDetailView
          deckId={viewState.deckId}
          onNavigate={legacyNavigate}
        />
      );
    }
    if (isDeckStudyView(viewState)) {
      return (
        <StudyView
          deckId={viewState.deckId}
          onNavigate={legacyNavigate}
        />
      );
    }

    // Views without data
    switch (currentView) {
      case "phrase-library":
        return <PhraseLibraryView />;
      case "learn":
        return <StudyView onNavigate={legacyNavigate} />;
      case "stats":
        return <StatsView />;
      case "questions":
        return <QuestionsView />;
      case "settings":
        return <SettingsView />;
      case "notes":
        return <NotesView />;
      case "materials":
        return <MaterialsView onNavigate={legacyNavigate} />;
      case "material-create":
        return <MaterialCreateView onNavigate={legacyNavigate} />;
      case "decks":
        return <DecksView onNavigate={legacyNavigate} />;
      default:
        return <PhraseLibraryView />;
    }
  };

  return (
    <>
      <Layout
        currentView={currentView}
        onNavigate={legacyNavigate}
        onQuickNoteOpen={() => setIsQuickNoteOpen(true)}
      >
        <ErrorBoundary
          onReset={() => navigate("phrase-library")}
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
