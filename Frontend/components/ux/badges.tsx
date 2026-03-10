"use client";

import { ShieldCheck, ShieldX } from "lucide-react";
import { cn } from "@/components/ui/utils";

function normalizeStatus(value: string): "pending" | "in-progress" | "resolved" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "in progress") {
    return "in-progress";
  }
  if (normalized === "resolved") {
    return "resolved";
  }
  return "pending";
}

function normalizePriority(value: string): "low" | "medium" | "high" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "low") {
    return "low";
  }
  if (normalized === "high") {
    return "high";
  }
  return "medium";
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const label = normalized === "in-progress" ? "In Progress" : normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return (
    <span className="ff-badge" data-status={normalized}>
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const normalized = normalizePriority(priority);
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return (
    <span className="ff-badge" data-priority={normalized}>
      {label}
    </span>
  );
}

export function UnitBadge({ unit }: { unit: string }) {
  return (
    <span className="ff-badge border-border bg-muted text-foreground">
      {unit}
    </span>
  );
}

export function AccountStatusBadge({ disabled }: { disabled?: boolean }) {
  if (disabled) {
    return (
      <span className={cn("ff-role-badge border-red-300 bg-red-100 text-red-700")}>
        <ShieldX className="h-3.5 w-3.5" />
        Disabled
      </span>
    );
  }

  return (
    <span className={cn("ff-role-badge border-blue-300 bg-blue-100 text-blue-700")}>
      <ShieldCheck className="h-3.5 w-3.5" />
      Active
    </span>
  );
}

export function RoleBadge({
  role,
  className,
}: {
  role: "user" | "admin" | "superadmin";
  className?: string;
}) {
  const roleClass =
    role === "superadmin"
      ? "border-slate-300 bg-slate-100 text-slate-800"
      : role === "admin"
        ? "border-blue-300 bg-blue-100 text-blue-700"
        : "border-emerald-300 bg-emerald-100 text-emerald-700";
  return (
    <span className={cn("ff-role-badge", roleClass, className)}>
      {role}
    </span>
  );
}

