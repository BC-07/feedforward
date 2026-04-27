import type { ReactNode } from "react";

type UserDashboardHomeViewProps = {
  children?: ReactNode;
};

export function UserDashboardHomeView({ children }: UserDashboardHomeViewProps) {
  return <>{children ?? null}</>;
}
