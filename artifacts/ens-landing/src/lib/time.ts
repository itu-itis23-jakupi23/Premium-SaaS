/**
 * Formats a date or ISO string into a friendly relative time (e.g., "5 mins ago", "2 hours ago").
 */
export function formatRelativeTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return "";

  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  const time = date.getTime();
  if (Number.isNaN(time)) return String(dateInput);

  const now = Date.now();
  const diffInSeconds = Math.floor((now - time) / 1000);

  if (diffInSeconds < 30) return "just now";
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks}w ago`;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
