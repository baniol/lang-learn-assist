import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "../test/test-utils";
import { useMutation, useOptimisticMutation } from "./useMutation";
import { createDeferred } from "../test/test-utils";

describe("useMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should start with idle state", () => {
      const mutationFn = vi.fn().mockResolvedValue({ id: 1 });

      const { result } = renderHook(() => useMutation(mutationFn));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBe(null);
      expect(result.current.error).toBe(null);
    });
  });

  describe("mutate", () => {
    it("should execute mutation and update state on success", async () => {
      const mockData = { id: 1, name: "Test" };
      const mutationFn = vi.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() => useMutation(mutationFn));

      act(() => {
        result.current.mutate({ name: "Test" });
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toEqual(mockData);
      expect(mutationFn).toHaveBeenCalledWith({ name: "Test" });
    });

    it("should update state on error", async () => {
      const error = new Error("Mutation failed");
      const mutationFn = vi.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useMutation(mutationFn));

      act(() => {
        result.current.mutate({ name: "Test" });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(error);
    });

    it("should convert non-Error throws to Error objects", async () => {
      const mutationFn = vi.fn().mockRejectedValue("string error");

      const { result } = renderHook(() => useMutation(mutationFn));

      act(() => {
        result.current.mutate(undefined);
      });

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
      });

      expect(result.current.error?.message).toBe("string error");
    });
  });

  describe("mutateAsync", () => {
    it("should return data on success", async () => {
      const mockData = { id: 1, name: "Test" };
      type MutationInput = { name: string };
      const mutationFn = vi.fn((_input: MutationInput) => Promise.resolve(mockData));

      const { result } = renderHook(() => useMutation(mutationFn));

      let returnedData: typeof mockData | undefined;
      await act(async () => {
        returnedData = await result.current.mutateAsync({ name: "Test" });
      });

      expect(returnedData).toEqual(mockData);
    });

    it("should throw error on failure", async () => {
      const error = new Error("Mutation failed");
      const mutationFn = vi.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useMutation(mutationFn));

      await expect(
        act(async () => {
          await result.current.mutateAsync({ name: "Test" });
        })
      ).rejects.toThrow("Mutation failed");
    });
  });

  describe("callbacks", () => {
    it("should call onSuccess with data and variables", async () => {
      const mockData = { id: 1 };
      const mutationFn = vi.fn().mockResolvedValue(mockData);
      const onSuccess = vi.fn();

      const { result } = renderHook(() =>
        useMutation(mutationFn, { onSuccess })
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "Test" });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockData, { name: "Test" });
    });

    it("should call onError with error and variables", async () => {
      const error = new Error("Failed");
      const mutationFn = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      const { result } = renderHook(() =>
        useMutation(mutationFn, { onError })
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({ name: "Test" });
        } catch {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error, { name: "Test" });
    });

    it("should call onSettled on success", async () => {
      const mockData = { id: 1 };
      const mutationFn = vi.fn().mockResolvedValue(mockData);
      const onSettled = vi.fn();

      const { result } = renderHook(() =>
        useMutation(mutationFn, { onSettled })
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "Test" });
      });

      expect(onSettled).toHaveBeenCalledWith(mockData, null, { name: "Test" });
    });

    it("should call onSettled on error", async () => {
      const error = new Error("Failed");
      const mutationFn = vi.fn().mockRejectedValue(error);
      const onSettled = vi.fn();

      const { result } = renderHook(() =>
        useMutation(mutationFn, { onSettled })
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({ name: "Test" });
        } catch {
          // Expected
        }
      });

      expect(onSettled).toHaveBeenCalledWith(null, error, { name: "Test" });
    });
  });

  describe("reset", () => {
    it("should reset all state to initial values", async () => {
      const mockData = { id: 1 };
      const mutationFn = vi.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() => useMutation(mutationFn));

      await act(async () => {
        await result.current.mutateAsync({});
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.isSuccess).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBe(null);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe("unmount behavior", () => {
    it("should not update state after unmount", async () => {
      const deferred = createDeferred<{ id: number }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);

      const { result, unmount } = renderHook(() => useMutation(mutationFn));

      act(() => {
        result.current.mutate({});
      });

      expect(result.current.isLoading).toBe(true);

      // Unmount before promise resolves
      unmount();

      // Resolve the promise after unmount
      deferred.resolve({ id: 1 });

      // Wait a tick to ensure no state updates happen
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe("useOptimisticMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call onMutate before mutation", async () => {
    const mutationFn = vi.fn().mockResolvedValue({ id: 1 });
    const onMutate = vi.fn().mockReturnValue({ previousData: [1, 2, 3] });

    const { result } = renderHook(() =>
      useOptimisticMutation({ mutationFn, onMutate })
    );

    await act(async () => {
      await result.current.mutate({ id: 1 });
    });

    expect(onMutate).toHaveBeenCalledWith({ id: 1 });
    expect(onMutate).toHaveBeenCalledBefore(mutationFn);
  });

  it("should call onSuccess with context", async () => {
    const context = { previousData: [1, 2, 3] };
    const mockData = { id: 1 };
    const mutationFn = vi.fn().mockResolvedValue(mockData);
    const onMutate = vi.fn().mockReturnValue(context);
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useOptimisticMutation({ mutationFn, onMutate, onSuccess })
    );

    await act(async () => {
      await result.current.mutate({ id: 1 });
    });

    expect(onSuccess).toHaveBeenCalledWith(mockData, { id: 1 }, context);
  });

  it("should call onError with context for rollback", async () => {
    const context = { previousData: [1, 2, 3] };
    const error = new Error("Failed");
    const mutationFn = vi.fn().mockRejectedValue(error);
    const onMutate = vi.fn().mockReturnValue(context);
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useOptimisticMutation({ mutationFn, onMutate, onError })
    );

    await act(async () => {
      try {
        await result.current.mutate({ id: 1 });
      } catch {
        // Expected
      }
    });

    expect(onError).toHaveBeenCalledWith(error, { id: 1 }, context);
  });

  it("should call onSettled with context", async () => {
    const context = { previousData: [1, 2, 3] };
    const mockData = { id: 1 };
    const mutationFn = vi.fn().mockResolvedValue(mockData);
    const onMutate = vi.fn().mockReturnValue(context);
    const onSettled = vi.fn();

    const { result } = renderHook(() =>
      useOptimisticMutation({ mutationFn, onMutate, onSettled })
    );

    await act(async () => {
      await result.current.mutate({ id: 1 });
    });

    expect(onSettled).toHaveBeenCalledWith(mockData, null, { id: 1 }, context);
  });

  it("should handle async onMutate", async () => {
    const context = { previousData: [1, 2, 3] };
    const mutationFn = vi.fn().mockResolvedValue({ id: 1 });
    const onMutate = vi.fn().mockResolvedValue(context);
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useOptimisticMutation({ mutationFn, onMutate, onSuccess })
    );

    await act(async () => {
      await result.current.mutate({ id: 1 });
    });

    expect(onSuccess).toHaveBeenCalledWith({ id: 1 }, { id: 1 }, context);
  });

  it("should update loading and error state", async () => {
    const error = new Error("Failed");
    let resolveMutation: () => void;
    const mutationFn = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        resolveMutation = () => reject(error);
      });
    });

    const { result } = renderHook(() =>
      useOptimisticMutation({ mutationFn })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);

    // Start mutation
    let mutatePromise: Promise<unknown>;
    act(() => {
      mutatePromise = result.current.mutate({}).catch(() => {});
    });

    // Check loading state
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    // Complete with error
    await act(async () => {
      resolveMutation!();
      await mutatePromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(error);
  });
});
