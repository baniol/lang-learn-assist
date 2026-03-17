/**
 * Type-safe navigation system.
 *
 * This module provides discriminated union types for view state,
 * ensuring that navigation data is correctly typed for each view.
 */

/**
 * Discriminated union of all possible view states.
 * Each view type has its associated data requirements.
 */
export type ViewState =
  | { type: "phrase-library" }
  | { type: "settings" }
  | { type: "materials" }
  | { type: "material-create" }
  | { type: "material-review"; materialId: number }
  | { type: "material-practice"; materialId: number };

/**
 * Extract the view type string from ViewState.
 */
export type ViewType = ViewState["type"];

/**
 * Get the data type for a specific view.
 * Returns never for views without data, or the data shape for views with data.
 */
export type ViewDataFor<T extends ViewType> = Extract<
  ViewState,
  { type: T }
> extends { type: T } & infer R
  ? Omit<R, "type"> extends Record<string, never>
    ? undefined
    : Omit<R, "type">
  : never;

/**
 * Views that require additional data.
 */
export type ViewWithData = Extract<
  ViewState,
  { type: string; materialId: number }
>["type"];

/**
 * Views that don't require any data.
 */
export type ViewWithoutData = Exclude<ViewType, ViewWithData>;

/**
 * Type-safe navigation function.
 * Overloaded to require data for views that need it.
 */
export interface NavigateFn {
  (view: ViewWithoutData): void;
  <T extends ViewWithData>(view: T, data: ViewDataFor<T>): void;
}

/**
 * Creates the initial view state for a given view type.
 */
export function createViewState<T extends ViewWithoutData>(view: T): ViewState;
export function createViewState<T extends ViewWithData>(
  view: T,
  data: ViewDataFor<T>
): ViewState;
export function createViewState(
  view: ViewType,
  data?: Record<string, unknown>
): ViewState {
  return { type: view, ...data } as ViewState;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if the current view is the material review view.
 */
export function isMaterialReviewView(
  state: ViewState
): state is { type: "material-review"; materialId: number } {
  return state.type === "material-review";
}

/**
 * Check if the current view is the material practice view.
 */
export function isMaterialPracticeView(
  state: ViewState
): state is { type: "material-practice"; materialId: number } {
  return state.type === "material-practice";
}

/**
 * Check if a view requires data.
 */
export function viewRequiresData(view: ViewType): view is ViewWithData {
  return view === "material-review" || view === "material-practice";
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Get the parent view for sub-views (for breadcrumb/back navigation).
 */
export function getParentView(view: ViewType): ViewType | null {
  switch (view) {
    case "material-create":
    case "material-review":
    case "material-practice":
      return "materials";
    default:
      return null;
  }
}

/**
 * Check if a view is a sub-view of another.
 */
export function isSubViewOf(view: ViewType, parent: ViewType): boolean {
  return getParentView(view) === parent;
}

/**
 * Get the active nav item for a given view (handles sub-views).
 */
export function getActiveNavItem(view: ViewType): ViewType {
  switch (view) {
    case "material-create":
    case "material-review":
    case "material-practice":
      return "materials";
    default:
      return view;
  }
}
