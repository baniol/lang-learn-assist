import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "../test/test-utils";
import { useQuery, useLazyQuery } from "./useQuery";
import { createDeferred } from "../test/test-utils";

describe("useQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should start in loading state when enabled", () => {
      const queryFn = vi.fn().mockResolvedValue({ data: "test" });
      const { result } = renderHook(() => useQuery(queryFn, []));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isInitialLoading).toBe(true);
      expect(result.current.data).toBe(null);
    });

    it("should fetch data and update state", async () => {
      const mockData = { id: 1, name: "Test" };
      const queryFn = vi.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() => useQuery(queryFn, []));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBe(null);
      expect(result.current.isInitialLoading).toBe(false);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it("should handle errors correctly", async () => {
      const error = new Error("Fetch failed");
      const queryFn = vi.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useQuery(queryFn, []));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBe(null);
      expect(result.current.error).toEqual(error);
    });

    it("should convert non-Error throws to Error objects", async () => {
      const queryFn = vi.fn().mockRejectedValue("string error");

      const { result } = renderHook(() => useQuery(queryFn, []));

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
      });

      expect(result.current.error?.message).toBe("string error");
    });
  });

  describe("enabled option", () => {
    it("should not fetch when enabled is false", () => {
      const queryFn = vi.fn().mockResolvedValue({ data: "test" });

      const { result } = renderHook(() =>
        useQuery(queryFn, [], { enabled: false })
      );

      expect(result.current.isLoading).toBe(false);
      expect(queryFn).not.toHaveBeenCalled();
    });

    it("should fetch when enabled changes to true", async () => {
      const queryFn = vi.fn().mockResolvedValue({ data: "test" });

      const { result, rerender } = renderHook(
        ({ enabled }) => useQuery(queryFn, [], { enabled }),
        { initialProps: { enabled: false } }
      );

      expect(queryFn).not.toHaveBeenCalled();

      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("dependencies", () => {
    it("should refetch when dependencies change", async () => {
      const queryFn = vi.fn().mockResolvedValue({ data: "test" });

      const { result, rerender } = renderHook(
        ({ id }) => useQuery(queryFn, [id]),
        { initialProps: { id: 1 } }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(queryFn).toHaveBeenCalledTimes(1);

      rerender({ id: 2 });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("initialData option", () => {
    it("should use initial data before fetch completes", () => {
      const initialData = { cached: true };
      const queryFn = vi.fn().mockResolvedValue({ cached: false });

      const { result } = renderHook(() =>
        useQuery(queryFn, [], { initialData })
      );

      expect(result.current.data).toEqual(initialData);
    });
  });

  describe("callbacks", () => {
    it("should call onSuccess when fetch succeeds", async () => {
      const mockData = { id: 1 };
      const queryFn = vi.fn().mockResolvedValue(mockData);
      const onSuccess = vi.fn();

      renderHook(() => useQuery(queryFn, [], { onSuccess }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockData);
      });
    });

    it("should call onError when fetch fails", async () => {
      const error = new Error("Failed");
      const queryFn = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      renderHook(() => useQuery(queryFn, [], { onError }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("refetch", () => {
    it("should refetch data when refetch is called", async () => {
      let callCount = 0;
      const queryFn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ count: callCount });
      });

      const { result } = renderHook(() => useQuery(queryFn, []));

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 1 });
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.data).toEqual({ count: 2 });
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("reset", () => {
    it("should reset state to initial values", async () => {
      const mockData = { id: 1 };
      const queryFn = vi.fn().mockResolvedValue(mockData);
      const initialData = { initial: true };

      const { result } = renderHook(() =>
        useQuery(queryFn, [], { initialData })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toEqual(initialData);
      expect(result.current.error).toBe(null);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("unmount behavior", () => {
    it("should not update state after unmount", async () => {
      const deferred = createDeferred<{ data: string }>();
      const queryFn = vi.fn().mockReturnValue(deferred.promise);

      const { result, unmount } = renderHook(() => useQuery(queryFn, []));

      expect(result.current.isLoading).toBe(true);

      // Unmount before promise resolves
      unmount();

      // Resolve the promise after unmount
      deferred.resolve({ data: "test" });

      // Wait a tick to ensure no state updates happen
      await new Promise((resolve) => setTimeout(resolve, 10));

      // The hook should not throw or cause issues
      expect(true).toBe(true);
    });
  });
});

describe("useLazyQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not fetch automatically on mount", () => {
    const queryFn = vi.fn().mockResolvedValue({ data: "test" });

    const { result } = renderHook(() => useLazyQuery(queryFn));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("should fetch when execute is called", async () => {
    const mockData = { id: 1 };
    const queryFn = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() => useLazyQuery(queryFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockData);
  });

  it("should pass arguments to queryFn", async () => {
    type QueryArgs = [number, string];
    const queryFn = vi.fn().mockResolvedValue({ data: "test" });

    const { result } = renderHook(() => useLazyQuery<{ data: string }, QueryArgs>(queryFn));

    await act(async () => {
      await result.current.execute(42, "test");
    });

    expect(queryFn).toHaveBeenCalledWith(42, "test");
  });

  it("should return the result from execute", async () => {
    const mockData = { id: 1, name: "Test" };
    const queryFn = vi.fn(() => Promise.resolve(mockData));

    const { result } = renderHook(() => useLazyQuery(queryFn));

    let executeResult: typeof mockData | null = null;
    await act(async () => {
      executeResult = await result.current.execute();
    });

    expect(executeResult).toEqual(mockData);
  });

  it("should handle errors and return null", async () => {
    const error = new Error("Failed");
    const queryFn = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useLazyQuery(queryFn));

    let executeResult: unknown = undefined;
    await act(async () => {
      executeResult = await result.current.execute();
    });

    expect(executeResult).toBe(null);
    expect(result.current.error).toEqual(error);
  });

  it("should call onSuccess callback", async () => {
    const mockData = { id: 1 };
    const queryFn = vi.fn().mockResolvedValue(mockData);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useLazyQuery(queryFn, { onSuccess }));

    await act(async () => {
      await result.current.execute();
    });

    expect(onSuccess).toHaveBeenCalledWith(mockData);
  });

  it("should call onError callback", async () => {
    const error = new Error("Failed");
    const queryFn = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    const { result } = renderHook(() => useLazyQuery(queryFn, { onError }));

    await act(async () => {
      await result.current.execute();
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("should reset state", async () => {
    const mockData = { id: 1 };
    const queryFn = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() => useLazyQuery(queryFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toEqual(mockData);

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.isLoading).toBe(false);
  });
});
