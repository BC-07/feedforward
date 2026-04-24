"use client";

import { Suspense } from "react";
import { AdminDashboardShell } from "@/components/admin/AdminDashboardShell";
import { AdminFeedbackWorkspace } from "@/components/admin/AdminFeedbackWorkspace";
import { useAdminSession } from "@/components/admin/useAdminSession";

export default function AdminFeedbackSubmissionPage() {
  const currentAdmin = useAdminSession();

  return (
    <AdminDashboardShell
      title="Feedback Submission"
      description="Search, filter, review, and manage all submissions for your assigned unit from this page."
      currentAdmin={currentAdmin}
    >
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading feedback workspace...</div>}>
        <AdminFeedbackWorkspace currentAdmin={currentAdmin} />
      </Suspense>
    </AdminDashboardShell>
  );
}