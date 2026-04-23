"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { Feedback } from "@/lib/api";
import { CheckCircle, Circle, Clock, Wrench } from "lucide-react";

type FeedbackStatusCardProps = {
  feedback: Feedback;
  formatDate: (value: string) => string;
  className?: string;
};

const getStatusIconTone = (status: string) => {
  switch (status.trim().toLowerCase()) {
    case "resolved":
      return "text-green-700";
    case "in progress":
      return "text-orange-700";
    default:
      return "text-orange-700";
  }
};

const renderStatusIcon = (status: string, className: string) => {
  switch (status.trim().toLowerCase()) {
    case "resolved":
      return <CheckCircle className={className} />;
    case "in progress":
      return <Wrench className={className} />;
    default:
      return <Clock className={className} />;
  }
};

const getStatusMessage = (status: string) => {
  switch (status.trim().toLowerCase()) {
    case "resolved":
      return "Your feedback has been addressed and resolved.";
    case "in progress":
      return "We are actively working on addressing your feedback.";
    default:
      return "Your feedback has been received and is awaiting review.";
  }
};

const getStatusSteps = (currentStatus: string) => {
  const order = ["pending", "in progress", "resolved"];
  const normalized = currentStatus.trim().toLowerCase();
  const currentIndex = order.indexOf(normalized);
  return [
    {
      name: "Submitted",
      completed: true,
      description: "",
    },
    {
      name: "In Progress",
      completed: currentIndex >= 1,
      description: "Actions being taken",
    },
    {
      name: "Resolved",
      completed: currentIndex >= 2,
      description: "Issue addressed",
    },
  ];
};

export function FeedbackStatusCard({
  feedback,
  formatDate,
  className,
}: FeedbackStatusCardProps) {
  const steps = getStatusSteps(feedback.status);

  return (
    <Card className={["shadow-lg", className].filter(Boolean).join(" ")}>
      <CardContent className="pt-4">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="mb-1 text-base font-semibold">
            Status: <span className="uppercase">{feedback.status}</span>
          </h3>
        </div>

        <div className="space-y-2.5">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.completed ? "bg-green-500/20" : "bg-gray-200"
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-700" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                {index < steps.length - 1 && <div className="h-12 w-px bg-border"></div>}
              </div>
              <div className="pb-2.5 flex-1">
                <p className="text-[0.98rem] font-semibold">{step.name}</p>
                {step.name === "Submitted" && (
                  <p className="text-[0.88rem] text-muted-foreground">
                    {formatDate(feedback.createdAt)}
                  </p>
                )}
                {step.description && (
                  <p className="text-[0.88rem] text-muted-foreground">{step.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          {renderStatusIcon(
            feedback.status,
            `mt-0.5 h-4.5 w-4.5 flex-shrink-0 ${getStatusIconTone(
              feedback.status,
            )}`,
          )}
          <p className="text-[0.9rem]">{getStatusMessage(feedback.status)}</p>
        </div>
      </CardContent>
    </Card>
  );
}