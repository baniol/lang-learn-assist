import { cn } from "../../lib/utils";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "purple";

export type BadgeSize = "sm" | "md";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  success: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  error: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  info: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-1 text-xs",
};

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", size = "md", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Status badge for phrase learning progress.
 */
export function PhraseStatusBadge({
  status,
  className,
}: {
  status: "new" | "learning" | "learned";
  className?: string;
}) {
  const config = {
    new: { variant: "default" as const, label: "New" },
    learning: { variant: "warning" as const, label: "Learning" },
    learned: { variant: "success" as const, label: "Learned" },
  };

  const { variant, label } = config[status];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

/**
 * Determines phrase status from progress data.
 */
export function getPhraseStatus(
  progress: {
    totalAttempts: number;
    correctStreak: number;
  } | null
): "new" | "learning" | "learned" {
  if (!progress || progress.totalAttempts === 0) return "new";
  if (progress.correctStreak >= 2) return "learned";
  return "learning";
}
