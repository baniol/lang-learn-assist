import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
  highlight?: boolean;
  icon?: ReactNode;
  description?: string;
}

export function SettingsSection({
  title,
  children,
  className,
  highlight,
  icon,
  description,
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        "bg-white dark:bg-slate-800 rounded-lg p-6",
        highlight
          ? "border-2 border-blue-200 dark:border-blue-800"
          : "border border-slate-200 dark:border-slate-700",
        className
      )}
    >
      <div className={cn("mb-4", icon && "flex items-center gap-3")}>
        {icon}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h2>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
