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
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {children}
      </div>
    </div>
  );
}