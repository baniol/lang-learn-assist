import { cn } from "../../lib/utils";

export interface IconProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

// Helper to create stroke-based icons
function createStrokeIcon(
  path: React.ReactNode,
  { viewBox = "0 0 24 24", strokeWidth = 2 } = {},
) {
  return function Icon({ className, size = "md" }: IconProps) {
    return (
      <svg
        className={cn(sizeMap[size], className)}
        fill="none"
        viewBox={viewBox}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {path}
      </svg>
    );
  };
}

// Helper to create fill-based icons
function createFillIcon(path: React.ReactNode, { viewBox = "0 0 24 24" } = {}) {
  return function Icon({ className, size = "md" }: IconProps) {
    return (
      <svg
        className={cn(sizeMap[size], className)}
        fill="currentColor"
        viewBox={viewBox}
      >
        {path}
      </svg>
    );
  };
}

// ============================================================================
// Navigation Icons
// ============================================================================

export const ChatIcon = createStrokeIcon(
  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
);

export const BookIcon = createStrokeIcon(
  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
);

export const ArchiveIcon = createStrokeIcon(
  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />,
);

export const LightbulbIcon = createStrokeIcon(
  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
);

export const ChartIcon = createStrokeIcon(
  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
);

export const QuestionCircleIcon = createStrokeIcon(
  <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
);

export const NoteIcon = createStrokeIcon(
  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
);

export const SettingsIcon = createStrokeIcon(
  <>
    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </>,
);

// ============================================================================
// Action Icons
// ============================================================================

export const PlayIcon = createFillIcon(<path d="M8 5v14l11-7z" />);

export const PauseIcon = createFillIcon(
  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />,
);

export const StopIcon = createFillIcon(
  <>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </>,
);

export const PlusIcon = createStrokeIcon(<path d="M12 4v16m8-8H4" />);

export const MinusIcon = createStrokeIcon(<path d="M20 12H4" />);

export const CloseIcon = createStrokeIcon(<path d="M6 18L18 6M6 6l12 12" />);

export const CheckIcon = createStrokeIcon(<path d="M5 13l4 4L19 7" />);

export const ChevronLeftIcon = createStrokeIcon(<path d="M15 19l-7-7 7-7" />);

export const ChevronRightIcon = createStrokeIcon(<path d="M9 5l7 7-7 7" />);

export const ChevronUpIcon = createStrokeIcon(<path d="M5 15l7-7 7 7" />);

export const ChevronDownIcon = createStrokeIcon(<path d="M19 9l-7 7-7-7" />);

export const TrashIcon = createStrokeIcon(
  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
);

export const EditIcon = createStrokeIcon(
  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
);

export const SendIcon = createStrokeIcon(
  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
);

export const RefreshIcon = createStrokeIcon(
  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
);

export const SearchIcon = createStrokeIcon(
  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
);

export const DownloadIcon = createStrokeIcon(
  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
);

export const UploadIcon = createStrokeIcon(
  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,
);

// ============================================================================
// Status Icons
// ============================================================================

export const WarningIcon = createStrokeIcon(
  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
);

export const CheckCircleIcon = createStrokeIcon(
  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
);

export const ExclamationCircleIcon = createStrokeIcon(
  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
);

export const InfoCircleIcon = createStrokeIcon(
  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
);

export const ExcludeIcon = createStrokeIcon(
  <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />,
);

export const CalendarIcon = createStrokeIcon(
  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
);

// ============================================================================
// Media Icons
// ============================================================================

export const MicrophoneIcon = createFillIcon(
  <>
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
  </>,
);

export const VolumeUpIcon = createStrokeIcon(
  <path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />,
);

export const VolumeOffIcon = createStrokeIcon(
  <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm13.657-10.343l-12 12" />,
);

export const MicrophoneOutlineIcon = createStrokeIcon(
  <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />,
);

// ============================================================================
// Special Icons (with custom props)
// ============================================================================

/**
 * Star icon with filled state support.
 */
export function StarIcon({
  className,
  size = "md",
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      className={cn(sizeMap[size], className)}
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

/**
 * Play/Pause toggle icon.
 */
export function PlayPauseIcon({
  className,
  size = "md",
  isPlaying = false,
}: IconProps & { isPlaying?: boolean }) {
  if (isPlaying) {
    return <PauseIcon className={className} size={size} />;
  }
  return <PlayIcon className={className} size={size} />;
}

/**
 * Animated loading dots.
 */
export function LoadingDotsIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
      <div
        className="w-2 h-2 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "0.1s" }}
      />
      <div
        className="w-2 h-2 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "0.2s" }}
      />
    </div>
  );
}

/**
 * Circular play button with background.
 */
export function PlayCircleIcon({ className, size = "md" }: IconProps) {
  return (
    <svg
      className={cn(sizeMap[size], className)}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        fillRule="evenodd"
        d="M15.528 8.47l-4.604-2.654A1 1 0 009.5 6.684v5.632a1 1 0 001.424.868l4.604-2.654a1 1 0 000-1.736z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12zm11-9a9 9 0 100 18 9 9 0 000-18z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * External link icon (arrow pointing out of box).
 */
export const ExternalLinkIcon = createStrokeIcon(
  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />,
);

/**
 * Copy icon.
 */
export const CopyIcon = createStrokeIcon(
  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />,
);

/**
 * Globe/Language icon.
 */
export const GlobeIcon = createStrokeIcon(
  <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />,
);

/**
 * Filter icon.
 */
export const FilterIcon = createStrokeIcon(
  <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />,
);

/**
 * Sort icon.
 */
export const SortIcon = createStrokeIcon(
  <path d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />,
);

/**
 * Dots vertical (more options) icon.
 */
export const DotsVerticalIcon = createStrokeIcon(
  <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />,
);

/**
 * Clock/Time icon.
 */
export const ClockIcon = createStrokeIcon(
  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
);

/**
 * User icon.
 */
export const UserIcon = createStrokeIcon(
  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
);

/**
 * AI/Sparkles icon.
 */
export const SparklesIcon = createStrokeIcon(
  <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />,
);

/**
 * Alert triangle icon (alias for WarningIcon, commonly used in error states).
 */
export const AlertTriangleIcon = WarningIcon;

/**
 * Inbox icon (empty state indicator).
 */
export const InboxIcon = createStrokeIcon(
  <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />,
);

/**
 * Bookmark icon with filled state support.
 */
export function BookmarkIcon({
  className,
  size = "md",
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      className={cn(sizeMap[size], className)}
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}
