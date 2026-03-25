import { toast } from "sonner";

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function toastApiError(error: unknown, fallback: string) {
  toast.error(getErrorMessage(error, fallback));
}

