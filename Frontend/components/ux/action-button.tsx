"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type ActionKind = "edit" | "disable" | "delete";

export function ActionButton({
  action,
  icon,
  label,
  className,
  ...props
}: {
  action: ActionKind;
  icon: ReactNode;
  label: string;
  className?: string;
} & Omit<ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button
      variant="outline"
      size="sm"
      data-action={action}
      className={cn("ff-action-btn", className)}
      {...props}
    >
      {icon}
      {label}
    </Button>
  );
}
