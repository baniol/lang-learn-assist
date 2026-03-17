import { Button } from "../ui";
import { AlertTriangleIcon } from "../icons";

interface ErrorFallbackProps {
  /** The error that was caught */
  error: Error | null;
  /** Called when the user clicks "Try Again" */
  onReset?: () => void;
  /** Title to display */
  title?: string;
  /** Custom message to display instead of error message */
  message?: string;
}

/**
 * Fallback UI displayed when an error boundary catches an error.
 * Shows error details and a retry button.
 */
export function ErrorFallback({
  error,
  onReset,
  title = "Something went wrong",
  message,
}: ErrorFallbackProps) {
  const displayMessage = message || error?.message || "An unexpected error occurred";

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
      <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-red-100 dark:bg-red-900/30">
        <AlertTriangleIcon className="text-red-600 dark:text-red-400" size="lg" />
      </div>

      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h2>

      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">{displayMessage}</p>

      {import.meta.env.DEV && error?.stack && (
        <pre className="text-left text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 max-w-full overflow-auto max-h-32">
          {error.stack}
        </pre>
      )}

      {onReset && (
        <Button onClick={onReset} variant="primary">
          Try Again
        </Button>
      )}
    </div>
  );
}
