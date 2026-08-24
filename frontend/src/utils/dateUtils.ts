/**
 * Formats an ISO date string into a user-friendly format.
 * Scheduled format: Aug 24, 2026, 10:30 PM
 * Sent format (includes seconds): Aug 24, 2026, 10:30:04 PM
 */
export const formatDateTime = (dateStr: string | null, includeSeconds = false): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: includeSeconds ? "2-digit" : undefined,
      hour12: true,
    });
  } catch {
    return "-";
  }
};

/**
 * Formats a date string putting the time first, with seconds:
 * e.g., 10:30:04 PM (Aug 24)
 */
export const formatTimeFirst = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";

    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const dateStrFormatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    return `${timeStr} (${dateStrFormatted})`;
  } catch {
    return "-";
  }
};

/**
 * Calculates the difference in seconds between the scheduled time and actual sent time.
 */
export const getDelaySeconds = (scheduledTimeStr: string, sentTimeStr: string | null): number | null => {
  if (!sentTimeStr) return null;
  try {
    const scheduled = new Date(scheduledTimeStr).getTime();
    const sent = new Date(sentTimeStr).getTime();
    if (isNaN(scheduled) || isNaN(sent)) return null;
    const diffMs = sent - scheduled;
    return diffMs > 0 ? Math.floor(diffMs / 1000) : 0;
  } catch {
    return null;
  }
};

/**
 * Formats a delay duration in a friendly format.
 */
export const formatDelay = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
};
