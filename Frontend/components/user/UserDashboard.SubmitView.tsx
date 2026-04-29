"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UserDashboardSubmitViewProps {
  leftColumnRef?: React.RefObject<HTMLDivElement | null>;
  renderSubmissionForm: (idPrefix: string) => React.ReactNode;
}

export function UserDashboardSubmitView({
  leftColumnRef,
  renderSubmissionForm,
}: UserDashboardSubmitViewProps) {
  return (
    <div
      ref={leftColumnRef}
      className="mx-auto w-full max-w-3xl flex flex-col gap-6"
    >
      {/* Submit Feedback */}
      <div>
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Feedback Form</CardTitle>
            <CardDescription>
              Check anonymous if you want your name hidden from admin views.
            </CardDescription>
          </CardHeader>
          <CardContent>{renderSubmissionForm("submit")}</CardContent>
        </Card>
      </div>
    </div>
  );
}