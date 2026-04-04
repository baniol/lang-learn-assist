import { cn } from "../lib/utils";
import type { RecordingStatus } from "../hooks/useVoiceRecording";
import { MicrophoneIcon, RefreshIcon, WarningIcon, type IconProps } from "./icons";

interface VoiceButtonProps {
  status: RecordingStatus;
  isAvailable: boolean;
  onPress: () => void;
  onRelease: () => void;
  size?: "sm" | "md" | "lg";
}

// Map VoiceButton sizes to icon system sizes
const iconSizeMap: Record<"sm" | "md" | "lg", IconProps["size"]> = {
  sm: "md", // w-5 h-5
  md: "lg", // w-6 h-6
  lg: "xl", // w-8 h-8
};

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

  const iconSize = iconSizeMap[size];

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
        return <MicrophoneIcon size={iconSize} />;
      case "transcribing":
        return <RefreshIcon size={iconSize} />;
      case "error":
        return <WarningIcon size={iconSize} />;
      default:
        return <MicrophoneIcon size={iconSize} />;
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
      className={cn(
        sizeClasses[size],
        "rounded-full flex items-center justify-center transition-all duration-200",
        getStatusStyles()
      )}
    >
      {getIcon()}
    </button>
  );
}
