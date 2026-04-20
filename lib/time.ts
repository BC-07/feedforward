function parseAppDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "number") {
    const dateFromNumber = new Date(input);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }

  let value = String(input).trim();
  if (!value) return null;

  // Safari-compatible timezone suffix when backend returns +0800.
  if (/[+-]\d{4}$/.test(value)) {
    value = `${value.slice(0, -5)}${value.slice(-5, -2)}:${value.slice(-2)}`;
  }

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  if (!hasTimezone) {
    // If timezone is missing, backend values are expected to be Asia/Manila (UTC+8).
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2}(?:\.\d+)?)?$/.test(value)) {
      value = value.replace(" ", "T");
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(?:\.\d+)?)?$/.test(value)) {
      value = `${value}+08:00`;
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatLocalTime(input: string | number | Date | null | undefined): string {
  const date = parseAppDate(input);
  if (!date) return "";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLocalDateTime(input: string | number | Date | null | undefined): string {
  const date = parseAppDate(input);
  if (!date) return "";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
