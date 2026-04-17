"use client";

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
      <AdminFeedbackWorkspace currentAdmin={currentAdmin} />
    </AdminDashboardShell>
  );
}
