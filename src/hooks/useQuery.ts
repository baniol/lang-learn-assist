import { useState, useEffect, useCallback, useRef, type DependencyList } from "react";

export interface UseQueryOptions<T> {
  /** If false, query won't run automatically on mount */
  enabled?: boolean;
  /** Initial data before first fetch */
  initialData?: T | null;
  /** Called on successful fetch */
  onSuccess?: (data: T) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface UseQueryResult<T> {
  /** The fetched data, or null if not yet loaded */
  data: T | null;
  /** Whether the query is currently loading */
  isLoading: boolean;
  /** Whether this is the initial load (no data yet) */
  isInitialLoading: boolean;
  /** Error if the query failed */
  error: Error | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Reset the query state */
  reset: () => void;
}

/**
 * Hook for data fetching with loading and error states.
 *
 * @param queryFn - Async function that fetches data
 * @param deps - Dependencies that trigger a refetch when changed
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const { data: phrases, isLoading, error, refetch } = useQuery(
 *   () => invoke<Phrase[]>("get_phrases", { status: "active" }),
 *   [status]
 * );
 * ```
 */
export function useQuery<T>(
  queryFn: () => Promise<T>,
  deps: DependencyList = [],
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const { enabled = true, initialData = null, onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Store callbacks in refs to avoid dependency issues
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const queryFnRef = useRef(queryFn);

  // Update refs when callbacks change
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  queryFnRef.current = queryFn;

  const execute = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await queryFnRef.current();
      if (isMountedRef.current) {
        setData(result);
        setHasLoaded(true);
        onSuccessRef.current?.(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onErrorRef.current?.(error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Run query on mount and when deps change
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      execute();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const refetch = useCallback(async () => {
    await execute();
  }, [execute]);

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setIsLoading(false);
    setHasLoaded(false);
  }, [initialData]);

  return {
    data,
    isLoading,
    isInitialLoading: isLoading && !hasLoaded,
    error,
    refetch,
    reset,
  };
}

/**
 * Hook for lazy queries that don't run automatically.
 * Useful when you need to fetch data in response to user action.
 *
 * @example
 * ```tsx
 * const { data, isLoading, execute } = useLazyQuery(
 *   (id: number) => invoke<Phrase>("get_phrase", { id })
 * );
 *
 * const handleClick = async (id: number) => {
 *   await execute(id);
 * };
 * ```
 */
export function useLazyQuery<T, TArgs extends unknown[] = []>(
  queryFn: (...args: TArgs) => Promise<T>,
  options: Omit<UseQueryOptions<T>, "enabled"> = {}
) {
  const { initialData = null, onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: TArgs): Promise<T | null> => {
      if (!isMountedRef.current) return null;

      setIsLoading(true);
      setError(null);

      try {
        const result = await queryFn(...args);
        if (isMountedRef.current) {
          setData(result);
          onSuccessRef.current?.(result);
        }
        return result;
      } catch (err) {
        if (isMountedRef.current) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onErrorRef.current?.(error);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [queryFn]
  );

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setIsLoading(false);
  }, [initialData]);

  return {
    data,
    isLoading,
    error,
    execute,
    reset,
  };
}
