"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Feedback } from "@/lib/api";

interface DashboardStats {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
}

interface UserDashboardHomeViewProps {
  dashboardStats: DashboardStats;
  latestSubmissionCards: Feedback[];
  needsAttentionCards: Feedback[];
  recentlyUpdatedCards: Feedback[];
  homeNotifications: Feedback[];
  notificationPanelMaxHeight: number;
  onViewFeedback: (feedback: Feedback) => void;
  onCreateSubmission: () => void;
  renderCreateSubmissionDialog: () => React.ReactNode;
  renderHomeSubmissionGrid: (items: Feedback[], emptyMessage: string) => React.ReactNode;
  getStatusBadgeClass: (status: string) => string;
  getStatusIcon: (status: string) => React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export function UserDashboardHomeView({
  dashboardStats,
  latestSubmissionCards,
  needsAttentionCards,
  recentlyUpdatedCards,
  homeNotifications,
  notificationPanelMaxHeight,
  onViewFeedback,
  onCreateSubmission,
  renderCreateSubmissionDialog,
  renderHomeSubmissionGrid,
  getStatusBadgeClass,
  getStatusIcon,
}: UserDashboardHomeViewProps) {
  return (
    <div className="ff-user-dashboard-theme flex flex-col bg-background">
      {/* Create submission dialog */}
      {renderCreateSubmissionDialog()}

      {/* Stats cards grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-black">
              Total
            </p>
            <p className="mt-1 text-2xl font-semibold text-black">
              {dashboardStats.total}
            </p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-black">
              Pending
            </p>
            <p
              className="mt-1 text-2xl font-semibold"
              style={{ color: "#d28a00" }}
            >
              {dashboardStats.pending}
            </p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-black">
              In Progress
            </p>
            <p
              className="mt-1 text-2xl font-semibold"
              style={{ color: "#2563eb" }}
            >
              {dashboardStats.inProgress}
            </p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-black">
              Resolved
            </p>
            <p
              className="mt-1 text-2xl font-semibold"
              style={{ color: "#00a63e" }}
            >
              {dashboardStats.resolved}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and notifications section */}
      <div className="mt-4">
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          {/* Tabs section */}
          <div className="min-w-0">
            <Tabs defaultValue="latest">
              <TabsList className="grid h-11 w-full grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/50 p-1">
                <TabsTrigger
                  value="latest"
                  className="h-full rounded-lg border-0 text-xs font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-black data-[state=active]:shadow-sm sm:text-sm"
                >
                  Latest
                </TabsTrigger>
                <TabsTrigger
                  value="attention"
                  className="h-full rounded-lg border-0 text-xs font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-black data-[state=active]:shadow-sm sm:text-sm"
                >
                  Needs Attention
                </TabsTrigger>
                <TabsTrigger
                  value="updated"
                  className="h-full rounded-lg border-0 text-xs font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-black data-[state=active]:shadow-sm sm:text-sm"
                >
                  Recently Updated
                </TabsTrigger>
              </TabsList>
              <TabsContent value="latest" className="mt-3">
                {renderHomeSubmissionGrid(
                  latestSubmissionCards,
                  "No submissions yet. Click New Submission to create your first one.",
                )}
              </TabsContent>
              <TabsContent value="attention" className="mt-3">
                {renderHomeSubmissionGrid(
                  needsAttentionCards,
                  "Nothing needs attention right now.",
                )}
              </TabsContent>
              <TabsContent value="updated" className="mt-3">
                {renderHomeSubmissionGrid(
                  recentlyUpdatedCards,
                  "No recent updates yet.",
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Notifications panel */}
          <Card
            className="h-full border border-border/80 bg-slate-50/45 shadow-sm flex flex-col overflow-hidden"
            style={{
              maxHeight: `${notificationPanelMaxHeight}px`,
            }}
          >
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-base text-black">
                Notifications
              </CardTitle>
              <CardDescription className="text-black">
                Unresolved updates
              </CardDescription>
            </CardHeader>
            <CardContent className="-mt-4 flex-1 min-h-0 space-y-1.5 bg-slate-50/35 pt-0 pb-3 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {homeNotifications.length === 0 ? (
                <p className="text-sm text-black">
                  No unread updates.
                </p>
              ) : (
                homeNotifications.map((feedback) => (
                  <button
                    key={feedback.id}
                    type="button"
                    onClick={() => onViewFeedback(feedback)}
                    className="w-full rounded-md border border-border/70 bg-white/80 p-2 text-left shadow-[0_0_0_1px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-muted/30 hover:shadow-md"
                  >
                    <p className="line-clamp-1 text-sm font-medium text-[#708090]">
                      {feedback.subject}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "#666666" }}
                    >
                      {new Date(feedback.updatedAt).toLocaleDateString("en-US")}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}