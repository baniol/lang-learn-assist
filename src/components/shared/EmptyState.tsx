import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "../ui";
import { InboxIcon } from "../icons";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
}

interface EmptyStateProps {
  /** Icon to display - defaults to InboxIcon */
  icon?: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Custom className for the container */
  className?: string;
}

/**
 * Displays an empty state with icon, title, description, and optional actions.
 * Use when a list or section has no content to display.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<BookIcon size="xl" />}
 *   title="No phrases yet"
 *   description="Start a conversation to extract phrases"
 *   action={{ label: "New Conversation", onClick: () => {} }}
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    >
      <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800">
        {icon || <InboxIcon className="text-gray-400 dark:text-gray-500" size="lg" />}
      </div>

      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">{title}</h3>

      {description && (
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <Button onClick={action.onClick} variant={action.variant || "primary"}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant={secondaryAction.variant || "ghost"}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
