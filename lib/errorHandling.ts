import { toast } from "sonner";

type MessageCarrier = {
  message?: unknown;
  data?: unknown;
};

function readNestedMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const carrier = value as MessageCarrier;

  if (typeof carrier.message === "string" && carrier.message.trim()) {
    return carrier.message.trim();
  }

  if (carrier.data && typeof carrier.data === "object") {
    const data = carrier.data as MessageCarrier;
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
  }

  return null;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const nested = readNestedMessage(error);
  if (nested) return nested;

  return fallback;
}

export function toastApiError(error: unknown, fallback = "Request failed"): void {
  toast.error(getErrorMessage(error, fallback));
}
