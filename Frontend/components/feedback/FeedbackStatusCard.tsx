"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { Feedback } from "@/lib/api";
import { CheckCircle, Circle, Clock } from "lucide-react";

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
  const statusMessage = getStatusMessage(feedback.status);
  const normalizedStatus = feedback.status.trim().toLowerCase();

  return (
    <Card className={["shadow-lg", className].filter(Boolean).join(" ")}>
      <CardContent className="flex h-full flex-col pt-4">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="mb-1 text-[1.1rem] font-semibold">
            Status: <span className="uppercase">{feedback.status}</span>
          </h3>
        </div>

        <div className="flex h-full flex-1 flex-col">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`grid grid-cols-[1.6rem_minmax(0,1fr)] gap-3 ${
                index < steps.length - 1 ? "flex-1" : ""
              } ${
                index === steps.length - 1 ? "mb-4" : index === 1 ? "mb-2" : ""
              }`}
            >
              <div className="relative flex justify-center">
                <div
                  className={`h-6.5 w-6.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.completed ? "bg-green-500/20" : "bg-gray-200"
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-700" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                {index < steps.length - 1 ? (
                  <div className="pointer-events-none absolute left-1/2 top-7 bottom-0 w-px -translate-x-1/2 bg-border" />
                ) : null}
              </div>
              <div className="flex-1">
                <p className="text-[1.1rem] font-semibold">{step.name}</p>
                {(() => {
                  const stepTimestamp =
                    step.name === "Submitted"
                      ? feedback.createdAt
                      : step.name === "In Progress" && normalizedStatus === "in progress"
                        ? feedback.updatedAt
                        : step.name === "Resolved" && normalizedStatus === "resolved"
                          ? feedback.updatedAt
                          : null;

                  if (stepTimestamp) {
                    return (
                      <p className="text-[0.9rem] text-muted-foreground">
                        {formatDate(stepTimestamp)}
                      </p>
                    );
                  }

                  return step.description ? (
                    <p className="text-[0.9rem] text-muted-foreground">{step.description}</p>
                  ) : null;
                })()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-border/80 pt-3.5">
          <div className="flex items-start gap-2.5">
            {renderStatusIcon(
              feedback.status,
              `mt-0.5 h-4 w-4 flex-shrink-0 ${getStatusIconTone(feedback.status)}`,
            )}
            <p className="text-[0.9rem] text-muted-foreground">{statusMessage}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
