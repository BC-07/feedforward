"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";
import type { Feedback } from "@/lib/api";

type FeedbackDetailsCardProps = {
  feedback: Feedback;
  title?: string | null;
  formatDate?: (value: string) => string;
  className?: string;
  preSubjectContent?: ReactNode;
};

const defaultFormatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getPriorityColor = (priority: string) => {
  switch (priority.trim().toLowerCase()) {
    case "low":
      return "text-gray-600";
    case "medium":
      return "text-yellow-600";
    case "high":
      return "text-orange-600";
    default:
      return "text-gray-600";
  }
};

export function FeedbackDetailsCard({
  feedback,
  title = "Feedback Details",
  formatDate = defaultFormatDate,
  className,
  preSubjectContent,
}: FeedbackDetailsCardProps) {
  const hasTitle = Boolean(title?.trim());
  const contentClassName = hasTitle
    ? "space-y-2.5 overflow-hidden"
    : "space-y-8 overflow-hidden pt-4";
  const gridClassName = hasTitle
    ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
    : "grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2";

  return (
    <Card className={["shadow-lg", className].filter(Boolean).join(" ")}>
      {hasTitle ? (
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={contentClassName}>
        <div className={gridClassName}>
          <div className={hasTitle ? undefined : "space-y-1"}>
            <p className="text-xs font-semibold text-muted-foreground">Type</p>
            <p className="mt-0.5 text-[0.98rem] font-medium capitalize">{feedback.type}</p>
          </div>
          <div className={hasTitle ? undefined : "space-y-1"}>
            <p className="text-xs font-semibold text-muted-foreground">Category</p>
            <p className="mt-0.5 text-[0.98rem] font-medium">{feedback.category}</p>
          </div>
          <div className={hasTitle ? undefined : "space-y-1"}>
            <p className="text-xs font-semibold text-muted-foreground">Priority</p>
            <p
              className={`mt-0.5 text-[0.98rem] font-medium capitalize ${getPriorityColor(
                feedback.priority,
              )}`}
            >
              {feedback.priority}
            </p>
          </div>
          <div className={hasTitle ? undefined : "space-y-1"}>
            <p className="text-xs font-semibold text-muted-foreground">Last Updated</p>
            <p className="mt-0.5 text-[0.98rem] font-medium">{formatDate(feedback.updatedAt)}</p>
          </div>
        </div>

        {preSubjectContent}

        <div className={hasTitle ? "space-y-1" : "space-y-3"}>
          <p className="text-xs font-semibold text-muted-foreground">Subject</p>
          <p className="text-[0.98rem] font-semibold break-words">{feedback.subject}</p>
          <p className="mt-0.5 max-h-36 overflow-y-auto pr-1 text-[0.9rem] leading-relaxed [text-align:justify] [text-justify:inter-word] [text-indent:1rem] [overflow-wrap:anywhere] break-words hyphens-auto">
            {feedback.message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
