import { useState, useCallback } from "react";
import type {
  ViewState,
  ViewType,
  ViewWithData,
  ViewWithoutData,
  ViewDataFor,
} from "../types/navigation";
import { createViewState, getActiveNavItem } from "../types/navigation";

interface UseNavigationResult {
  /** Current view state with type-safe data */
  viewState: ViewState;
  /** Current view type */
  currentView: ViewType;
  /** Active nav item (handles sub-views like material-review -> materials) */
  activeNavItem: ViewType;
  /** Navigate to a view without data */
  navigate: {
    (view: ViewWithoutData): void;
    <T extends ViewWithData>(view: T, data: ViewDataFor<T>): void;
  };
}

/**
 * Hook for type-safe navigation between views.
 *
 * @example
 * ```tsx
 * const { viewState, navigate, currentView } = useNavigation();
 *
 * // Navigate to a simple view
 * navigate("phrase-library");
 *
 * // Navigate with required data (TypeScript enforces this)
 * navigate("material-review", { materialId: 123 });
 *
 * // Access view data with type guards
 * if (isMaterialReviewView(viewState)) {
 *   console.log(viewState.materialId); // number
 * }
 * ```
 */
export function useNavigation(
  initialView: ViewState = { type: "phrase-library" }
): UseNavigationResult {
  const [viewState, setViewState] = useState<ViewState>(initialView);

  const navigate = useCallback((view: ViewType, data?: Record<string, unknown>) => {
    if (data) {
      setViewState(
        createViewState(view as ViewWithData, data as unknown as ViewDataFor<ViewWithData>)
      );
    } else {
      setViewState(createViewState(view as ViewWithoutData));
    }
  }, []) as UseNavigationResult["navigate"];

  return {
    viewState,
    currentView: viewState.type,
    activeNavItem: getActiveNavItem(viewState.type),
    navigate,
  };
}
