"use client";

import {
  MessageSquare,
  Clock,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AdminStatsGridProps {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
  };
}

export function AdminStatsGrid({ stats }: AdminStatsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardDescription>Total Feedback</CardDescription>
          <CardTitle className="text-2xl sm:text-3xl">{stats.total}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            <span>All submissions</span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardDescription>Pending</CardDescription>
          <CardTitle className="text-2xl text-yellow-600 sm:text-3xl">
            {stats.pending}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Awaiting review</span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardDescription>In Progress</CardDescription>
          <CardTitle className="text-2xl text-blue-600 sm:text-3xl">
            {stats.inProgress}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Being addressed</span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardDescription>Resolved</CardDescription>
          <CardTitle className="text-2xl text-green-600 sm:text-3xl">
            {stats.resolved}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            <span>Completed</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
