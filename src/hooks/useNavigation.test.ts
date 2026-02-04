import { describe, it, expect } from "vitest";
import { renderHook, act } from "../test/test-utils";
import { useNavigation } from "./useNavigation";

describe("useNavigation", () => {
  describe("initial state", () => {
    it("should default to dashboard view", () => {
      const { result } = renderHook(() => useNavigation());

      expect(result.current.viewState).toEqual({ type: "dashboard" });
      expect(result.current.currentView).toBe("dashboard");
      expect(result.current.activeNavItem).toBe("dashboard");
    });

    it("should accept custom initial view", () => {
      const { result } = renderHook(() =>
        useNavigation({ type: "learn" })
      );

      expect(result.current.viewState).toEqual({ type: "learn" });
      expect(result.current.currentView).toBe("learn");
    });

    it("should accept initial view with data", () => {
      const { result } = renderHook(() =>
        useNavigation({ type: "conversation", conversationId: 123 })
      );

      expect(result.current.viewState).toEqual({
        type: "conversation",
        conversationId: 123,
      });
      expect(result.current.currentView).toBe("conversation");
      expect(result.current.activeNavItem).toBe("dashboard");
    });
  });

  describe("navigate", () => {
    describe("views without data", () => {
      it("should navigate to dashboard", () => {
        const { result } = renderHook(() =>
          useNavigation({ type: "learn" })
        );

        act(() => {
          result.current.navigate("dashboard");
        });

        expect(result.current.viewState).toEqual({ type: "dashboard" });
        expect(result.current.currentView).toBe("dashboard");
      });

      it("should navigate to phrase-library", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("phrase-library");
        });

        expect(result.current.viewState).toEqual({ type: "phrase-library" });
      });

      it("should navigate to learn", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("learn");
        });

        expect(result.current.viewState).toEqual({ type: "learn" });
      });

      it("should navigate to stats", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("stats");
        });

        expect(result.current.viewState).toEqual({ type: "stats" });
      });

      it("should navigate to questions", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("questions");
        });

        expect(result.current.viewState).toEqual({ type: "questions" });
      });

      it("should navigate to settings", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("settings");
        });

        expect(result.current.viewState).toEqual({ type: "settings" });
      });

      it("should navigate to notes", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("notes");
        });

        expect(result.current.viewState).toEqual({ type: "notes" });
      });

      it("should navigate to materials", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("materials");
        });

        expect(result.current.viewState).toEqual({ type: "materials" });
      });

      it("should navigate to material-create", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("material-create");
        });

        expect(result.current.viewState).toEqual({ type: "material-create" });
      });
    });

    describe("views with data", () => {
      it("should navigate to conversation with conversationId", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("conversation", { conversationId: 42 });
        });

        expect(result.current.viewState).toEqual({
          type: "conversation",
          conversationId: 42,
        });
      });

      it("should navigate to conversation-review with conversationId", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("conversation-review", { conversationId: 99 });
        });

        expect(result.current.viewState).toEqual({
          type: "conversation-review",
          conversationId: 99,
        });
      });

      it("should navigate to material-review with materialId", () => {
        const { result } = renderHook(() => useNavigation());

        act(() => {
          result.current.navigate("material-review", { materialId: 77 });
        });

        expect(result.current.viewState).toEqual({
          type: "material-review",
          materialId: 77,
        });
      });
    });
  });

  describe("activeNavItem", () => {
    it("should return dashboard when on conversation", () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.navigate("conversation", { conversationId: 1 });
      });

      expect(result.current.activeNavItem).toBe("dashboard");
    });

    it("should return dashboard when on conversation-review", () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.navigate("conversation-review", { conversationId: 1 });
      });

      expect(result.current.activeNavItem).toBe("dashboard");
    });

    it("should return materials when on material-create", () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.navigate("material-create");
      });

      expect(result.current.activeNavItem).toBe("materials");
    });

    it("should return materials when on material-review", () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.navigate("material-review", { materialId: 1 });
      });

      expect(result.current.activeNavItem).toBe("materials");
    });

    it("should return the view itself for top-level views", () => {
      const { result } = renderHook(() => useNavigation());

      const topLevelViews = [
        "dashboard",
        "phrase-library",
        "learn",
        "stats",
        "questions",
        "settings",
        "notes",
        "materials",
      ] as const;

      for (const view of topLevelViews) {
        act(() => {
          result.current.navigate(view);
        });
        expect(result.current.activeNavItem).toBe(view);
      }
    });
  });

  describe("navigation history", () => {
    it("should update state on each navigation", () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.navigate("learn");
      });
      expect(result.current.currentView).toBe("learn");

      act(() => {
        result.current.navigate("stats");
      });
      expect(result.current.currentView).toBe("stats");

      act(() => {
        result.current.navigate("conversation", { conversationId: 1 });
      });
      expect(result.current.currentView).toBe("conversation");

      act(() => {
        result.current.navigate("dashboard");
      });
      expect(result.current.currentView).toBe("dashboard");
    });
  });
});
