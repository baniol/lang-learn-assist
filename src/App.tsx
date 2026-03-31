import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ErrorBoundary } from "./components/shared";
import { Layout } from "./components/Layout";
import { PhraseLibraryView } from "./views/PhraseLibraryView";
import { SettingsView } from "./views/SettingsView";
import { MaterialsView } from "./views/MaterialsView";
import { MaterialCreateView } from "./views/MaterialCreateView";
import { MaterialReviewView } from "./views/MaterialReviewView";
import { MaterialPracticeView } from "./views/MaterialPracticeView";
import { PhraseExerciseView } from "./views/PhraseExerciseView";
import { ExerciseStatsView } from "./views/ExerciseStatsView";
import { PageSpinner } from "./components/ui";
import { useNavigation } from "./hooks";
import { isMaterialReviewView, isMaterialPracticeView } from "./types/navigation";

/**
 * Main application content.
 * Must be wrapped in SettingsProvider to access settings via context.
 */
function AppContent() {
  const { isLoading } = useSettings();
  const { viewState, currentView, navigate } = useNavigation();

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
    if (isMaterialPracticeView(viewState)) {
      return <MaterialPracticeView materialId={viewState.materialId} onNavigate={legacyNavigate} />;
    }

    if (isMaterialReviewView(viewState)) {
      return <MaterialReviewView materialId={viewState.materialId} onNavigate={legacyNavigate} />;
    }

    // Views without data
    switch (currentView) {
      case "phrase-library":
        return <PhraseLibraryView />;
      case "phrase-exercise":
        return <PhraseExerciseView />;
      case "exercise-stats":
        return <ExerciseStatsView />;
      case "settings":
        return <SettingsView />;
      case "materials":
        return <MaterialsView onNavigate={legacyNavigate} />;
      case "material-create":
        return <MaterialCreateView onNavigate={legacyNavigate} />;
      default:
        return <PhraseLibraryView />;
    }
  };

  return (
    <>
      <Layout currentView={currentView} onNavigate={legacyNavigate}>
        <ErrorBoundary
          onReset={() => navigate("phrase-library")}
          onError={(error) => console.error("View error:", error)}
        >
          {renderView()}
        </ErrorBoundary>
      </Layout>
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
