import { describe, it, expect } from "vitest";
import {
  createViewState,
  isMaterialReviewView,
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
  });

  describe("views with data", () => {
    it("should create material-review view state with materialId", () => {
      const state = createViewState("material-review", { materialId: 789 });
      expect(state).toEqual({ type: "material-review", materialId: 789 });
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
});

describe("viewRequiresData", () => {
  it("should return true for material-review", () => {
    expect(viewRequiresData("material-review")).toBe(true);
  });

  it("should return false for views without data", () => {
    expect(viewRequiresData("phrase-library")).toBe(false);
    expect(viewRequiresData("questions")).toBe(false);
    expect(viewRequiresData("settings")).toBe(false);
    expect(viewRequiresData("notes")).toBe(false);
    expect(viewRequiresData("materials")).toBe(false);
    expect(viewRequiresData("material-create")).toBe(false);
  });
});

describe("getParentView", () => {
  it("should return materials for material-create", () => {
    expect(getParentView("material-create")).toBe("materials");
  });

  it("should return materials for material-review", () => {
    expect(getParentView("material-review")).toBe("materials");
  });

  it("should return null for top-level views", () => {
    expect(getParentView("phrase-library")).toBe(null);
    expect(getParentView("questions")).toBe(null);
    expect(getParentView("settings")).toBe(null);
    expect(getParentView("notes")).toBe(null);
    expect(getParentView("materials")).toBe(null);
  });
});

describe("isSubViewOf", () => {
  it("should return true for material-create -> materials", () => {
    expect(isSubViewOf("material-create", "materials")).toBe(true);
  });

  it("should return true for material-review -> materials", () => {
    expect(isSubViewOf("material-review", "materials")).toBe(true);
  });

  it("should return false for incorrect parent", () => {
    expect(isSubViewOf("material-create", "phrase-library")).toBe(false);
  });

  it("should return false for top-level views", () => {
    expect(isSubViewOf("phrase-library", "phrase-library")).toBe(false);
  });
});

describe("getActiveNavItem", () => {
  it("should return materials for material views", () => {
    expect(getActiveNavItem("material-create")).toBe("materials");
    expect(getActiveNavItem("material-review")).toBe("materials");
  });

  it("should return the view itself for top-level views", () => {
    expect(getActiveNavItem("phrase-library")).toBe("phrase-library");
    expect(getActiveNavItem("questions")).toBe("questions");
    expect(getActiveNavItem("settings")).toBe("settings");
    expect(getActiveNavItem("notes")).toBe("notes");
    expect(getActiveNavItem("materials")).toBe("materials");
  });
});
