import type { ReactNode } from "react";

type UserDashboardSubmitViewProps = {
  children?: ReactNode;
};

export function UserDashboardSubmitView({ children }: UserDashboardSubmitViewProps) {
  return <>{children ?? null}</>;
}
