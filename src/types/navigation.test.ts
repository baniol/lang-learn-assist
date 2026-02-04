import { describe, it, expect } from "vitest";
import {
  createViewState,
  isConversationView,
  isConversationReviewView,
  isMaterialReviewView,
  viewRequiresData,
  getParentView,
  isSubViewOf,
  getActiveNavItem,
  type ViewState,
} from "./navigation";

describe("createViewState", () => {
  describe("views without data", () => {
    it("should create dashboard view state", () => {
      const state = createViewState("dashboard");
      expect(state).toEqual({ type: "dashboard" });
    });

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
  });

  describe("views with data", () => {
    it("should create conversation view state with conversationId", () => {
      const state = createViewState("conversation", { conversationId: 123 });
      expect(state).toEqual({ type: "conversation", conversationId: 123 });
    });

    it("should create conversation-review view state with conversationId", () => {
      const state = createViewState("conversation-review", { conversationId: 456 });
      expect(state).toEqual({ type: "conversation-review", conversationId: 456 });
    });

    it("should create material-review view state with materialId", () => {
      const state = createViewState("material-review", { materialId: 789 });
      expect(state).toEqual({ type: "material-review", materialId: 789 });
    });
  });
});

describe("type guards", () => {
  describe("isConversationView", () => {
    it("should return true for conversation view", () => {
      const state: ViewState = { type: "conversation", conversationId: 1 };
      expect(isConversationView(state)).toBe(true);
    });

    it("should return false for other views", () => {
      expect(isConversationView({ type: "dashboard" })).toBe(false);
      expect(isConversationView({ type: "conversation-review", conversationId: 1 })).toBe(false);
      expect(isConversationView({ type: "learn" })).toBe(false);
    });

    it("should narrow type correctly", () => {
      const state: ViewState = { type: "conversation", conversationId: 42 };
      if (isConversationView(state)) {
        // TypeScript should know conversationId exists
        expect(state.conversationId).toBe(42);
      }
    });
  });

  describe("isConversationReviewView", () => {
    it("should return true for conversation-review view", () => {
      const state: ViewState = { type: "conversation-review", conversationId: 1 };
      expect(isConversationReviewView(state)).toBe(true);
    });

    it("should return false for other views", () => {
      expect(isConversationReviewView({ type: "dashboard" })).toBe(false);
      expect(isConversationReviewView({ type: "conversation", conversationId: 1 })).toBe(false);
    });

    it("should narrow type correctly", () => {
      const state: ViewState = { type: "conversation-review", conversationId: 42 };
      if (isConversationReviewView(state)) {
        expect(state.conversationId).toBe(42);
      }
    });
  });

  describe("isMaterialReviewView", () => {
    it("should return true for material-review view", () => {
      const state: ViewState = { type: "material-review", materialId: 1 };
      expect(isMaterialReviewView(state)).toBe(true);
    });

    it("should return false for other views", () => {
      expect(isMaterialReviewView({ type: "dashboard" })).toBe(false);
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
  it("should return true for conversation", () => {
    expect(viewRequiresData("conversation")).toBe(true);
  });

  it("should return true for conversation-review", () => {
    expect(viewRequiresData("conversation-review")).toBe(true);
  });

  it("should return true for material-review", () => {
    expect(viewRequiresData("material-review")).toBe(true);
  });

  it("should return false for views without data", () => {
    expect(viewRequiresData("dashboard")).toBe(false);
    expect(viewRequiresData("phrase-library")).toBe(false);
    expect(viewRequiresData("learn")).toBe(false);
    expect(viewRequiresData("stats")).toBe(false);
    expect(viewRequiresData("questions")).toBe(false);
    expect(viewRequiresData("settings")).toBe(false);
    expect(viewRequiresData("notes")).toBe(false);
    expect(viewRequiresData("materials")).toBe(false);
    expect(viewRequiresData("material-create")).toBe(false);
  });
});

describe("getParentView", () => {
  it("should return dashboard for conversation", () => {
    expect(getParentView("conversation")).toBe("dashboard");
  });

  it("should return dashboard for conversation-review", () => {
    expect(getParentView("conversation-review")).toBe("dashboard");
  });

  it("should return materials for material-create", () => {
    expect(getParentView("material-create")).toBe("materials");
  });

  it("should return materials for material-review", () => {
    expect(getParentView("material-review")).toBe("materials");
  });

  it("should return null for top-level views", () => {
    expect(getParentView("dashboard")).toBe(null);
    expect(getParentView("phrase-library")).toBe(null);
    expect(getParentView("learn")).toBe(null);
    expect(getParentView("stats")).toBe(null);
    expect(getParentView("questions")).toBe(null);
    expect(getParentView("settings")).toBe(null);
    expect(getParentView("notes")).toBe(null);
    expect(getParentView("materials")).toBe(null);
  });
});

describe("isSubViewOf", () => {
  it("should return true for conversation -> dashboard", () => {
    expect(isSubViewOf("conversation", "dashboard")).toBe(true);
  });

  it("should return true for conversation-review -> dashboard", () => {
    expect(isSubViewOf("conversation-review", "dashboard")).toBe(true);
  });

  it("should return true for material-create -> materials", () => {
    expect(isSubViewOf("material-create", "materials")).toBe(true);
  });

  it("should return true for material-review -> materials", () => {
    expect(isSubViewOf("material-review", "materials")).toBe(true);
  });

  it("should return false for incorrect parent", () => {
    expect(isSubViewOf("conversation", "materials")).toBe(false);
    expect(isSubViewOf("material-create", "dashboard")).toBe(false);
  });

  it("should return false for top-level views", () => {
    expect(isSubViewOf("dashboard", "dashboard")).toBe(false);
    expect(isSubViewOf("learn", "dashboard")).toBe(false);
  });
});

describe("getActiveNavItem", () => {
  it("should return dashboard for conversation views", () => {
    expect(getActiveNavItem("conversation")).toBe("dashboard");
    expect(getActiveNavItem("conversation-review")).toBe("dashboard");
  });

  it("should return materials for material views", () => {
    expect(getActiveNavItem("material-create")).toBe("materials");
    expect(getActiveNavItem("material-review")).toBe("materials");
  });

  it("should return the view itself for top-level views", () => {
    expect(getActiveNavItem("dashboard")).toBe("dashboard");
    expect(getActiveNavItem("phrase-library")).toBe("phrase-library");
    expect(getActiveNavItem("learn")).toBe("learn");
    expect(getActiveNavItem("stats")).toBe("stats");
    expect(getActiveNavItem("questions")).toBe("questions");
    expect(getActiveNavItem("settings")).toBe("settings");
    expect(getActiveNavItem("notes")).toBe("notes");
    expect(getActiveNavItem("materials")).toBe("materials");
  });
});
