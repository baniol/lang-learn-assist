import { cn } from "../../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ children, className, padding = "md", hover = false }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700",
        paddingStyles[padding],
        hover && "hover:shadow-md transition-shadow",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-slate-200 dark:border-slate-700 pb-4 mb-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-lg font-semibold text-slate-800 dark:text-white", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn("text-sm text-slate-500 dark:text-slate-400", className)}>{children}</p>;
}

export function CardContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-t border-slate-200 dark:border-slate-700 pt-4 mt-4 flex justify-end gap-3",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Stats card for displaying metrics.
 */
export function StatsCard({
  value,
  label,
  variant = "default",
  className,
}: {
  value: string | number;
  label: string;
  variant?: "default" | "success" | "warning" | "info";
  className?: string;
}) {
  const variantStyles = {
    default: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    success: "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800",
    warning: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
    info: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
  };

  const textStyles = {
    default: "text-slate-800 dark:text-white",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  const labelStyles = {
    default: "text-slate-500 dark:text-slate-400",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  return (
    <div className={cn("rounded-lg border p-4 text-center", variantStyles[variant], className)}>
      <p className={cn("text-2xl font-bold", textStyles[variant])}>{value}</p>
      <p className={cn("text-sm", labelStyles[variant])}>{label}</p>
    </div>
  );
}
