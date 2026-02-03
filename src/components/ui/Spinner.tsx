import { cn } from "../../lib/utils";

export type SpinnerSize = "sm" | "md" | "lg";

const sizeStyles: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-blue-500 border-t-transparent",
        sizeStyles[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * Full-page centered loading spinner.
 */
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <Spinner size="md" />
    </div>
  );
}

/**
 * Inline loading spinner with optional text.
 */
export function InlineSpinner({
  text,
  size = "sm",
}: {
  text?: string;
  size?: SpinnerSize;
}) {
  return (
    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
      <Spinner size={size} />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}
