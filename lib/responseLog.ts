export type ParsedResponseEntry = {
  author: string;
  message: string;
  time?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function parseAdminResponses(raw: string | null | undefined): ParsedResponseEntry[] {
  const text = (raw ?? "").trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry): ParsedResponseEntry | null => {
          if (!isRecord(entry)) return null;
          const message = typeof entry.message === "string" ? entry.message.trim() : "";
          if (!message) return null;
          const author = typeof entry.author === "string" && entry.author.trim() ? entry.author.trim() : "Admin";
          const time = typeof entry.time === "string" && entry.time.trim() ? entry.time.trim() : undefined;
          return { author, message, time };
        })
        .filter((entry): entry is ParsedResponseEntry => entry !== null);
    }
  } catch {
    // Fall back to plain-text parsing.
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedLines = lines
    .map((line): ParsedResponseEntry | null => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (!match) return null;
      const author = match[1].trim() || "Admin";
      const message = match[2].trim();
      if (!message) return null;
      return { author, message };
    })
    .filter((entry): entry is ParsedResponseEntry => entry !== null);

  if (parsedLines.length > 0) return parsedLines;
  return [{ author: "Admin", message: text }];
}
