"use client";

import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="ff-state-card">
      <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="ff-state-card">
      <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ErrorState({
  title = "Failed to load data",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ff-state-card">
      <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button type="button" className="mt-4" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

