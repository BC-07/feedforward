export type ResponseLogEntry = {
  time: string | null;
  author: string | null;
  message: string;
};

const authorSeparatorCandidates = [" — ", " â€” "];

function splitAuthorMessage(rawMessage: string): { author: string | null; message: string } {
  for (const separator of authorSeparatorCandidates) {
    const parts = rawMessage.split(separator);
    if (parts.length >= 2) {
      const author = parts.shift()?.trim() || null;
      const message = parts.join(separator).trim();
      return { author, message };
    }
  }
  return { author: null, message: rawMessage.trim() };
}

export function parseAdminResponses(response?: string | null): ResponseLogEntry[] {
  if (!response) return [];
  return response
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[(.+?)\]\s*(.*)$/);
      if (!match) {
        return { time: null, author: null, message: line };
      }
      const rawMessage = match[2] || "";
      const { author, message } = splitAuthorMessage(rawMessage);
      return { time: match[1], author, message };
    })
    .filter((entry) => entry.message);
}

