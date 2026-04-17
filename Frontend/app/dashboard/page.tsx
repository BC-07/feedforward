"use client";

import { useEffect, useMemo, useState } from "react";
import { listFeedbacks, type Feedback } from "@/lib/api";
import { toastApiError } from "@/lib/errorHandling";
import { AdminDashboardShell } from "@/components/admin/AdminDashboardShell";
import { AdminFeedbackTypeChart } from "@/components/admin/AdminFeedbackTypeChart";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { useAdminSession } from "@/components/admin/useAdminSession";

export default function AdminDashboardHome() {
  const currentAdmin = useAdminSession();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  useEffect(() => {
    if (!currentAdmin?.unit) return;

    void listFeedbacks({ category: currentAdmin.unit })
      .then((data) => {
        setFeedbacks(data);
      })
      .catch((error) => {
        toastApiError(error, "Failed to load dashboard summary.");
      });
  }, [currentAdmin?.unit]);

  const stats = useMemo(
    () => ({
      total: feedbacks.length,
      pending: feedbacks.filter((item) => item.status === "Pending").length,
      inProgress: feedbacks.filter((item) => item.status === "In Progress")
        .length,
      resolved: feedbacks.filter((item) => item.status === "Resolved").length,
    }),
    [feedbacks],
  );

  return (
    <AdminDashboardShell
      title="Admin Dashboard"
      description="Use the burger menu on the left to switch between the dashboard home and the feedback submission workspace."
      currentAdmin={currentAdmin}
    >
      <div className="space-y-6">
        <AdminStatsGrid stats={stats} />
        <AdminFeedbackTypeChart feedbacks={feedbacks} />
      </div>
    </AdminDashboardShell>
  );
}
