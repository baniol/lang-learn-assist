import { ReactElement, ReactNode } from "react";
import { render, RenderOptions, renderHook, RenderHookOptions } from "@testing-library/react";

/**
 * Test wrapper that provides necessary context providers.
 * Add providers here as needed for testing.
 */
function TestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Custom render function that wraps components with test providers.
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

/**
 * Custom renderHook function that wraps hooks with test providers.
 */
function customRenderHook<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, "wrapper">
) {
  return renderHook(hook, { wrapper: TestWrapper, ...options });
}

// Re-export everything from @testing-library/react
export * from "@testing-library/react";

// Override render and renderHook with custom versions
export { customRender as render, customRenderHook as renderHook };

/**
 * Helper to create a deferred promise for testing async flows.
 */
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Helper to wait for a condition to be true.
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 1000
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error("Timeout waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Helper to flush all pending promises.
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
