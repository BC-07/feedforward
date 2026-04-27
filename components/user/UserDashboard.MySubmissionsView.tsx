import type { ReactNode } from "react";

type UserDashboardMySubmissionsViewProps = {
  children?: ReactNode;
};

export function UserDashboardMySubmissionsView({
  children,
}: UserDashboardMySubmissionsViewProps) {
  return <>{children ?? null}</>;
}
