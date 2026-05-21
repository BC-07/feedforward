"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CSSProperties, ReactNode } from "react";
import type { Feedback } from "@/lib/api";

type FeedbackDetailsCardProps = {
  feedback: Feedback;
  title?: string | null;
  formatDate?: (value: string) => string;
  className?: string;
  preSubjectContent?: ReactNode;
  showSubjectSeparators?: boolean;
  messageVisibleLines?: number;
  compactNoTitleLayout?: boolean;
  indentMessageFirstLineIfMultiline?: boolean;
  hidePriority?: boolean;
  hideDate?: boolean;
  dateLabel?: string;
  dateValue?: string;
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
  showSubjectSeparators,
  messageVisibleLines,
  compactNoTitleLayout,
  indentMessageFirstLineIfMultiline,
  hidePriority,
  hideDate,
  dateLabel,
  dateValue,
}: FeedbackDetailsCardProps) {
  const hasTitle = Boolean(title?.trim());
  const useCompactNoTitleLayout = compactNoTitleLayout && !hasTitle;
  const contentClassName = hasTitle
    ? "space-y-2.5 overflow-hidden"
    : useCompactNoTitleLayout
      ? "space-y-4 overflow-hidden pt-3"
      : "space-y-8 overflow-hidden pt-4";
  const gridClassName = hasTitle
    ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
    : useCompactNoTitleLayout
      ? "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2"
      : "grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2";
  const effectiveDateLabel = dateLabel || "Last Updated";
  const effectiveDateValue = dateValue || feedback.updatedAt;
  const messageStyle: CSSProperties | undefined = messageVisibleLines
    ? {
        display: "-webkit-box",
        WebkitLineClamp: messageVisibleLines,
        WebkitBoxOrient: "vertical",
      }
    : undefined;

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
            {!hidePriority ? (
              <>
                <p className="text-xs font-semibold text-muted-foreground">Priority</p>
                <p
                  className={`mt-0.5 text-[0.98rem] font-medium capitalize ${getPriorityColor(
                    feedback.priority,
                  )}`}
                >
                  {feedback.priority}
                </p>
              </>
            ) : null}
          </div>
          <div className={hasTitle ? undefined : "space-y-1"}>
            {!hideDate ? (
              <>
                <p className="text-xs font-semibold text-muted-foreground">{effectiveDateLabel}</p>
                <p className="mt-0.5 text-[0.98rem] font-medium">{formatDate(effectiveDateValue)}</p>
              </>
            ) : null}
          </div>
        </div>

        {preSubjectContent}

        {showSubjectSeparators ? (
          <div className="h-px w-full bg-border/70" />
        ) : null}

        <div className={hasTitle ? "space-y-1" : "space-y-3"}>
          <p className="text-xs font-semibold text-muted-foreground">Subject</p>
          <p className="text-[0.98rem] font-semibold break-words">{feedback.subject}</p>
          <p
            className={`mt-0.5 max-h-36 overflow-y-auto pr-1 text-[0.9rem] leading-relaxed [text-align:justify] [text-justify:inter-word] [overflow-wrap:anywhere] break-words hyphens-auto ${
              indentMessageFirstLineIfMultiline ? "[text-indent:1rem]" : ""
            }`}
            style={messageStyle}
          >
            {feedback.message}
          </p>
        </div>

        {showSubjectSeparators ? (
          <div className="h-px w-full bg-border/70" />
        ) : null}
      </CardContent>
    </Card>
  );
}