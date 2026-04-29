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
  leftColumnRef?: React.RefObject<HTMLDivElement>;
  renderSubmissionForm: (idPrefix: string) => React.ReactNode;
}

export function UserDashboardSubmitView({
  leftColumnRef,
  renderSubmissionForm,
}: UserDashboardSubmitViewProps) {
  return (
    <div
      ref={leftColumnRef}
      className="ff-user-dashboard-theme mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      {/* Submit Feedback */}
      <div>
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="font-normal">Feedback Form</CardTitle>
            <CardDescription className="text-black">
              Check anonymous if you want your name hidden from admin views.
            </CardDescription>
          </CardHeader>
          <CardContent>{renderSubmissionForm("submit")}</CardContent>
        </Card>
      </div>
    </div>
  );
}
