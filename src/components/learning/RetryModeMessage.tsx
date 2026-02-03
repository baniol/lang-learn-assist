interface RetryModeMessageProps {
  remainingRetries: number;
}

export function RetryModeMessage({ remainingRetries }: RetryModeMessageProps) {
  return (
    <div className="text-center py-4 mb-6 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
      <p className="text-amber-700 dark:text-amber-400 font-medium">
        Repeat correctly {remainingRetries} more time
        {remainingRetries !== 1 ? "s" : ""} to continue
      </p>
    </div>
  );
}
