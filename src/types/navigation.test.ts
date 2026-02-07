import { describe, it, expect } from "vitest";
import {
  createViewState,
  isMaterialReviewView,
  isDeckDetailView,
  isDeckStudyView,
  viewRequiresData,
  getParentView,
  isSubViewOf,
  getActiveNavItem,
  type ViewState,
} from "./navigation";

describe("createViewState", () => {
  describe("views without data", () => {
    it("should create phrase-library view state", () => {
      const state = createViewState("phrase-library");
      expect(state).toEqual({ type: "phrase-library" });
    });

    it("should create learn view state", () => {
      const state = createViewState("learn");
      expect(state).toEqual({ type: "learn" });
    });

    it("should create stats view state", () => {
      const state = createViewState("stats");
      expect(state).toEqual({ type: "stats" });
    });

    it("should create questions view state", () => {
      const state = createViewState("questions");
      expect(state).toEqual({ type: "questions" });
    });

    it("should create settings view state", () => {
      const state = createViewState("settings");
      expect(state).toEqual({ type: "settings" });
    });

    it("should create notes view state", () => {
      const state = createViewState("notes");
      expect(state).toEqual({ type: "notes" });
    });

    it("should create materials view state", () => {
      const state = createViewState("materials");
      expect(state).toEqual({ type: "materials" });
    });

    it("should create material-create view state", () => {
      const state = createViewState("material-create");
      expect(state).toEqual({ type: "material-create" });
    });

    it("should create decks view state", () => {
      const state = createViewState("decks");
      expect(state).toEqual({ type: "decks" });
    });
  });

  describe("views with data", () => {
    it("should create material-review view state with materialId", () => {
      const state = createViewState("material-review", { materialId: 789 });
      expect(state).toEqual({ type: "material-review", materialId: 789 });
    });

    it("should create deck-detail view state with deckId", () => {
      const state = createViewState("deck-detail", { deckId: 123 });
      expect(state).toEqual({ type: "deck-detail", deckId: 123 });
    });

    it("should create deck-study view state with deckId", () => {
      const state = createViewState("deck-study", { deckId: 456 });
      expect(state).toEqual({ type: "deck-study", deckId: 456 });
    });
  });
});

describe("type guards", () => {
  describe("isMaterialReviewView", () => {
    it("should return true for material-review view", () => {
      const state: ViewState = { type: "material-review", materialId: 1 };
      expect(isMaterialReviewView(state)).toBe(true);
    });

    it("should return false for other views", () => {
      expect(isMaterialReviewView({ type: "phrase-library" })).toBe(false);
      expect(isMaterialReviewView({ type: "materials" })).toBe(false);
      expect(isMaterialReviewView({ type: "material-create" })).toBe(false);
    });

    it("should narrow type correctly", () => {
      const state: ViewState = { type: "material-review", materialId: 42 };
      if (isMaterialReviewView(state)) {
        expect(state.materialId).toBe(42);
      }
    });
  });

  describe("isDeckDetailView", () => {
    it("should return true for deck-detail view", () => {
      const state: ViewState = { type: "deck-detail", deckId: 1 };
      expect(isDeckDetailView(state)).toBe(true);
    });

    it("should return false for other views", () => {
      expect(isDeckDetailView({ type: "decks" })).toBe(false);
      expect(isDeckDetailView({ type: "deck-study", deckId: 1 })).toBe(false);
    });

    it("should narrow type correctly", () => {
      const state: ViewState = { type: "deck-detail", deckId: 42 };
      if (isDeckDetailView(state)) {
        expect(state.deckId).toBe(42);
      }
    });
  });

  describe("isDeckStudyView", () => {
    it("should return true for deck-study view", () => {
      const state: ViewState = { type: "deck-study", deckId: 1 };
      expect(isDeckStudyView(state)).toBe(true);
    });

    it("should return false for other views", () => {
      expect(isDeckStudyView({ type: "decks" })).toBe(false);
      expect(isDeckStudyView({ type: "deck-detail", deckId: 1 })).toBe(false);
    });

    it("should narrow type correctly", () => {
      const state: ViewState = { type: "deck-study", deckId: 42 };
      if (isDeckStudyView(state)) {
        expect(state.deckId).toBe(42);
      }
    });
  });
});

describe("viewRequiresData", () => {
  it("should return true for material-review", () => {
    expect(viewRequiresData("material-review")).toBe(true);
  });

  it("should return true for deck-detail", () => {
    expect(viewRequiresData("deck-detail")).toBe(true);
  });

  it("should return true for deck-study", () => {
    expect(viewRequiresData("deck-study")).toBe(true);
  });

  it("should return false for views without data", () => {
    expect(viewRequiresData("phrase-library")).toBe(false);
    expect(viewRequiresData("learn")).toBe(false);
    expect(viewRequiresData("stats")).toBe(false);
    expect(viewRequiresData("questions")).toBe(false);
    expect(viewRequiresData("settings")).toBe(false);
    expect(viewRequiresData("notes")).toBe(false);
    expect(viewRequiresData("materials")).toBe(false);
    expect(viewRequiresData("material-create")).toBe(false);
    expect(viewRequiresData("decks")).toBe(false);
  });
});

describe("getParentView", () => {
  it("should return materials for material-create", () => {
    expect(getParentView("material-create")).toBe("materials");
  });

  it("should return materials for material-review", () => {
    expect(getParentView("material-review")).toBe("materials");
  });

  it("should return decks for deck-detail", () => {
    expect(getParentView("deck-detail")).toBe("decks");
  });

  it("should return decks for deck-study", () => {
    expect(getParentView("deck-study")).toBe("decks");
  });

  it("should return null for top-level views", () => {
    expect(getParentView("phrase-library")).toBe(null);
    expect(getParentView("learn")).toBe(null);
    expect(getParentView("stats")).toBe(null);
    expect(getParentView("questions")).toBe(null);
    expect(getParentView("settings")).toBe(null);
    expect(getParentView("notes")).toBe(null);
    expect(getParentView("materials")).toBe(null);
    expect(getParentView("decks")).toBe(null);
  });
});

describe("isSubViewOf", () => {
  it("should return true for material-create -> materials", () => {
    expect(isSubViewOf("material-create", "materials")).toBe(true);
  });

  it("should return true for material-review -> materials", () => {
    expect(isSubViewOf("material-review", "materials")).toBe(true);
  });

  it("should return true for deck-detail -> decks", () => {
    expect(isSubViewOf("deck-detail", "decks")).toBe(true);
  });

  it("should return true for deck-study -> decks", () => {
    expect(isSubViewOf("deck-study", "decks")).toBe(true);
  });

  it("should return false for incorrect parent", () => {
    expect(isSubViewOf("material-create", "decks")).toBe(false);
    expect(isSubViewOf("deck-detail", "materials")).toBe(false);
  });

  it("should return false for top-level views", () => {
    expect(isSubViewOf("phrase-library", "phrase-library")).toBe(false);
    expect(isSubViewOf("learn", "phrase-library")).toBe(false);
  });
});

describe("getActiveNavItem", () => {
  it("should return materials for material views", () => {
    expect(getActiveNavItem("material-create")).toBe("materials");
    expect(getActiveNavItem("material-review")).toBe("materials");
  });

  it("should return decks for deck views", () => {
    expect(getActiveNavItem("deck-detail")).toBe("decks");
    expect(getActiveNavItem("deck-study")).toBe("decks");
  });

  it("should return the view itself for top-level views", () => {
    expect(getActiveNavItem("phrase-library")).toBe("phrase-library");
    expect(getActiveNavItem("learn")).toBe("learn");
    expect(getActiveNavItem("stats")).toBe("stats");
    expect(getActiveNavItem("questions")).toBe("questions");
    expect(getActiveNavItem("settings")).toBe("settings");
    expect(getActiveNavItem("notes")).toBe("notes");
    expect(getActiveNavItem("materials")).toBe("materials");
    expect(getActiveNavItem("decks")).toBe("decks");
  });
});
