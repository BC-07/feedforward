export function formatLocalTime(timeRaw?: string | null): string | null {
  if (!timeRaw) return null;
  const parsed = new Date(timeRaw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return timeRaw.replace(/\s*UTC\s*$/i, "");
}

