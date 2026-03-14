import { describe, it, expect } from "vitest";
import { renderHook, act } from "../test/test-utils";
import { useNavigation } from "./useNavigation";

describe("useNavigation", () => {
  describe("initial state", () => {
    it("should default to phrase-library view", () => {
      const { result } = renderHook(() => useNavigation());

      expect(result.current.viewState).toEqual({ type: "phrase-library" });
      expect(result.current.currentView).toBe("phrase-library");
      expect(result.current.activeNavItem).toBe("phrase-library");
    });

    it("should accept custom initial view", () => {
      const { result } = renderHook(() =>
        useNavigation({ type: "questions" })
      );

      expect(result.current.viewState).toEqual({ type: "questions" });
      expect(result.current.currentView).toBe("questions");
    });

    it("should accept initial view with data", () => {
      const { result } = renderHook(() =>
        useNavigation({ type: "material-review", materialId: 123 })
      );

      expect(result.current.viewState).toEqual({
        type: "material-review",
        materialId: 123,
      });
      expect(result.current.currentView).toBe("material-review");
      expect(result.current.activeNavItem).toBe("materials");
    });
  });

  describe("navigate", () => {
    describe("views without data", () => {
      it("should navigate to phrase-library", () => {
        const { result } = renderHook(() =>
          useNavigation({ type: "questions" })
        );

        act(() => {
          result.current.navigate("phrase-library");
        });

        expect(result.current.viewState).toEqual({ type: "phrase-library" });
        expect(result.current.currentView).toBe("phrase-library");
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
        "phrase-library",
        "questions",
        "settings",
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
        result.current.navigate("questions");
      });
      expect(result.current.currentView).toBe("questions");

      act(() => {
        result.current.navigate("material-review", { materialId: 1 });
      });
      expect(result.current.currentView).toBe("material-review");

      act(() => {
        result.current.navigate("phrase-library");
      });
      expect(result.current.currentView).toBe("phrase-library");
    });
  });
});
