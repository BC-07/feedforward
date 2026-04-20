import type { ReactNode } from "react";

type UserDashboardProps = {
  children: ReactNode;
  className?: string;
};

export default function UserDashboard({
  children,
  className = "",
}: UserDashboardProps) {
  const baseClassName = "container mx-auto px-4 py-6 sm:py-8";
  return <div className={`${baseClassName} ${className}`.trim()}>{children}</div>;
}
