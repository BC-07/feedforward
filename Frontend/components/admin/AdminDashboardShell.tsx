"use client";

import type { AdminSessionInfo } from "./useAdminSession";

interface AdminDashboardShellProps {
  title: string;
  description: string;
  currentAdmin: AdminSessionInfo | null;
  children: React.ReactNode;
}

export function AdminDashboardShell({
  title: _title,
  description: _description,
  currentAdmin,
  children,
}: AdminDashboardShellProps) {
  void _title;
  void _description;
  void currentAdmin;

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {children}
    </div>
  );
}
