import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { cn } from "../lib/utils";
import { UI } from "../lib/constants";
import { CheckCircleIcon, ExclamationCircleIcon, InfoCircleIcon, WarningIcon, CloseIcon } from "../components/icons";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  /** Currently visible toasts */
  toasts: Toast[];
  /** Show a toast notification */
  toast: (type: ToastType, message: string, duration?: number) => void;
  /** Convenience method for success toast */
  success: (message: string, duration?: number) => void;
  /** Convenience method for error toast */
  error: (message: string, duration?: number) => void;
  /** Convenience method for info toast */
  info: (message: string, duration?: number) => void;
  /** Convenience method for warning toast */
  warning: (message: string, duration?: number) => void;
  /** Remove a toast by ID */
  dismiss: (id: string) => void;
  /** Remove all toasts */
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, duration: number = UI.TOAST_DURATION_MS) => {
      const id = crypto.randomUUID();
      const newToast: Toast = { id, type, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, duration?: number) => showToast("success", message, duration),
    [showToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => showToast("error", message, duration),
    [showToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => showToast("info", message, duration),
    [showToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => showToast("warning", message, duration),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        toast: showToast,
        success,
        error,
        info,
        warning,
        dismiss,
        dismissAll,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast context.
 * Throws if used outside of ToastProvider.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ============================================================================
// Toast Container Component
// ============================================================================

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const config = {
    success: {
      bg: "bg-green-500",
      icon: CheckCircleIcon,
    },
    error: {
      bg: "bg-red-500",
      icon: ExclamationCircleIcon,
    },
    warning: {
      bg: "bg-amber-500",
      icon: WarningIcon,
    },
    info: {
      bg: "bg-blue-500",
      icon: InfoCircleIcon,
    },
  };

  const { bg, icon: Icon } = config[toast.type];

  return (
    <div
      className={cn(
        bg,
        "text-white px-4 py-3 rounded-lg shadow-lg",
        "flex items-start gap-3",
        "animate-in slide-in-from-right-5 fade-in duration-200"
      )}
      role="alert"
    >
      <Icon size="md" className="flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <CloseIcon size="sm" />
      </button>
    </div>
  );
}
