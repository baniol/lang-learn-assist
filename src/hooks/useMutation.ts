import { useState, useCallback, useRef, useEffect } from "react";

export interface UseMutationOptions<TData, TVariables> {
  /** Called on successful mutation */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Called on error */
  onError?: (error: Error, variables: TVariables) => void;
  /** Called when mutation completes (success or error) */
  onSettled?: (
    data: TData | null,
    error: Error | null,
    variables: TVariables
  ) => void;
}

export interface UseMutationResult<TData, TVariables> {
  /** Execute the mutation (fire and forget, errors handled via state) */
  mutate: (variables: TVariables) => void;
  /** Execute the mutation and return a promise */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** The data returned from the last successful mutation */
  data: TData | null;
  /** Whether a mutation is currently in progress */
  isLoading: boolean;
  /** Whether the last mutation was successful */
  isSuccess: boolean;
  /** Whether the last mutation failed */
  isError: boolean;
  /** Error from the last mutation */
  error: Error | null;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Hook for data mutations (create, update, delete operations).
 *
 * @param mutationFn - Async function that performs the mutation
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const deleteMutation = useMutation(
 *   (id: number) => invoke("delete_phrase", { id }),
 *   {
 *     onSuccess: () => {
 *       toast.success("Phrase deleted");
 *       refetchPhrases();
 *     },
 *     onError: (err) => toast.error(err.message),
 *   }
 * );
 *
 * // Fire and forget
 * deleteMutation.mutate(phraseId);
 *
 * // Or await the result
 * try {
 *   await deleteMutation.mutateAsync(phraseId);
 * } catch (err) {
 *   // Handle error
 * }
 * ```
 */
export function useMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationResult<TData, TVariables> {
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      if (isMountedRef.current) {
        setIsLoading(true);
        setIsSuccess(false);
        setIsError(false);
        setError(null);
      }

      try {
        const result = await mutationFn(variables);

        if (isMountedRef.current) {
          setData(result);
          setIsSuccess(true);
        }

        optionsRef.current.onSuccess?.(result, variables);
        optionsRef.current.onSettled?.(result, null, variables);

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (isMountedRef.current) {
          setError(error);
          setIsError(true);
        }

        optionsRef.current.onError?.(error, variables);
        optionsRef.current.onSettled?.(null, error, variables);

        throw error;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [mutationFn]
  );

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {
        // Error is already handled via state and callbacks
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  return {
    mutate,
    mutateAsync,
    data,
    isLoading,
    isSuccess,
    isError,
    error,
    reset,
  };
}

/**
 * Hook for optimistic updates with automatic rollback on error.
 *
 * @example
 * ```tsx
 * const toggleStar = useOptimisticMutation({
 *   mutationFn: (id: number) => invoke("toggle_starred", { id }),
 *   onMutate: (id) => {
 *     // Optimistically update UI
 *     const previousData = phrases;
 *     setPhrases(phrases.map(p =>
 *       p.id === id ? { ...p, starred: !p.starred } : p
 *     ));
 *     return { previousData };
 *   },
 *   onError: (err, id, context) => {
 *     // Rollback on error
 *     if (context?.previousData) {
 *       setPhrases(context.previousData);
 *     }
 *   },
 * });
 * ```
 */
export function useOptimisticMutation<TData, TVariables, TContext = unknown>({
  mutationFn,
  onMutate,
  onSuccess,
  onError,
  onSettled,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Called before the mutation, return value is passed to onError for rollback */
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  onError?: (error: Error, variables: TVariables, context: TContext) => void;
  onSettled?: (
    data: TData | null,
    error: Error | null,
    variables: TVariables,
    context: TContext
  ) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (variables: TVariables) => {
      setIsLoading(true);
      setError(null);

      let context: TContext | undefined;

      try {
        // Run optimistic update
        if (onMutate) {
          context = await onMutate(variables);
        }

        // Perform the actual mutation
        const result = await mutationFn(variables);

        if (isMountedRef.current) {
          setIsLoading(false);
        }

        onSuccess?.(result, variables, context as TContext);
        onSettled?.(result, null, variables, context as TContext);

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (isMountedRef.current) {
          setError(error);
          setIsLoading(false);
        }

        // Rollback using context
        onError?.(error, variables, context as TContext);
        onSettled?.(null, error, variables, context as TContext);

        throw error;
      }
    },
    [mutationFn, onMutate, onSuccess, onError, onSettled]
  );

  return {
    mutate,
    isLoading,
    error,
  };
}
