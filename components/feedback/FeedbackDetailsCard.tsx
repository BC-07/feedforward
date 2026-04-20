"use client";

import { useEffect, useMemo, useState } from "react";
import { type Feedback } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";

const MESSAGE_PREVIEW_MAX_CHARS = 220;

type FeedbackDetailsCardProps = {
  feedback: Feedback;
  title?: string;
  formatDate?: (dateString: string) => string;
  className?: string;
};

export function FeedbackDetailsCard({
  feedback,
  title = "Feedback Details",
  formatDate,
  className,
}: FeedbackDetailsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [feedback.id]);

  const trimmedMessage = feedback.message.trim();
  const canExpandMessage = trimmedMessage.length > MESSAGE_PREVIEW_MAX_CHARS;
  const displayedMessage = useMemo(() => {
    if (isExpanded || !canExpandMessage) return feedback.message;
    return `${feedback.message.slice(0, MESSAGE_PREVIEW_MAX_CHARS)}...`;
  }, [canExpandMessage, feedback.message, isExpanded]);

  return (
    <Card className={cn("shadow-lg", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
            <p className="mt-1 text-sm font-medium text-foreground">{feedback.type}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
            <p className="mt-1 text-sm font-medium text-foreground">{feedback.category}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
          <p className="mt-1 text-sm font-medium text-foreground">{feedback.subject}</p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Message</p>
          <p className="mt-1 whitespace-pre-wrap break-all text-sm leading-relaxed text-foreground">
            {displayedMessage}
          </p>
          {canExpandMessage ? (
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="mt-2 text-xs font-medium text-accent hover:underline"
            >
              {isExpanded ? "See less" : "See all"}
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <span className="font-medium text-foreground">Submitted by:</span>{" "}
            {feedback.isAnonymous ? "Anonymous" : feedback.userName}
          </div>
          {formatDate ? (
            <div>
              <span className="font-medium text-foreground">Created:</span> {formatDate(feedback.createdAt)}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
