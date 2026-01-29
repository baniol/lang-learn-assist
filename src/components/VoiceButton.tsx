import type { RecordingStatus } from "../hooks/useVoiceRecording";

interface VoiceButtonProps {
  status: RecordingStatus;
  isAvailable: boolean;
  onPress: () => void;
  onRelease: () => void;
  size?: "sm" | "md" | "lg";
}

export function VoiceButton({
  status,
  isAvailable,
  onPress,
  onRelease,
  size = "md",
}: VoiceButtonProps) {
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const getStatusStyles = () => {
    switch (status) {
      case "recording":
        return "bg-red-500 text-white animate-pulse";
      case "transcribing":
        return "bg-amber-500 text-white animate-spin";
      case "error":
        return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
      default:
        return isAvailable
          ? "bg-blue-500 text-white hover:bg-blue-600"
          : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed";
    }
  };

  const getIcon = () => {
    switch (status) {
      case "recording":
        return (
          <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        );
      case "transcribing":
        return (
          <svg className={iconSizes[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case "error":
        return (
          <svg className={iconSizes[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      default:
        return (
          <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        );
    }
  };

  return (
    <button
      type="button"
      disabled={!isAvailable || status === "transcribing"}
      onMouseDown={isAvailable && status === "idle" ? onPress : undefined}
      onMouseUp={isAvailable && status === "recording" ? onRelease : undefined}
      onMouseLeave={isAvailable && status === "recording" ? onRelease : undefined}
      onTouchStart={isAvailable && status === "idle" ? onPress : undefined}
      onTouchEnd={isAvailable && status === "recording" ? onRelease : undefined}
      className={`
        ${sizeClasses[size]}
        rounded-full flex items-center justify-center
        transition-all duration-200
        ${getStatusStyles()}
      `}
    >
      {getIcon()}
    </button>
  );
}
