"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Feedback } from "@/lib/api";

type FeedbackDetailsCardProps = {
  feedback: Feedback;
  title?: string;
  formatDate?: (value: string) => string;
  className?: string;
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
}: FeedbackDetailsCardProps) {
  return (
    <Card className={["shadow-lg", className].filter(Boolean).join(" ")}>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 overflow-hidden">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Type</p>
            <p className="mt-0.5 text-base font-medium capitalize">{feedback.type}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Category</p>
            <p className="mt-0.5 text-base font-medium">{feedback.category}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Priority</p>
            <p
              className={`mt-0.5 text-base font-medium capitalize ${getPriorityColor(
                feedback.priority,
              )}`}
            >
              {feedback.priority}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Last Updated</p>
            <p className="mt-0.5 text-base font-medium">{formatDate(feedback.updatedAt)}</p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">Subject</p>
          <p className="text-base font-semibold break-words">{feedback.subject}</p>
          <p className="mt-0.5 max-h-40 overflow-y-auto pr-1 text-sm leading-relaxed [text-align:justify] [text-justify:inter-word] [text-indent:1rem] [overflow-wrap:anywhere] break-words hyphens-auto">
            {feedback.message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
