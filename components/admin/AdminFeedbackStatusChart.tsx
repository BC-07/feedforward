"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import type { Feedback } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface AdminFeedbackStatusChartProps {
  feedbacks: Feedback[];
}

const chartConfig = {
  pending: {
    label: "Pending",
    color: "#f59e0b",
  },
  inProgress: {
    label: "In Progress",
    color: "#3b82f6",
  },
  resolved: {
    label: "Resolved",
    color: "#10b981",
  },
} satisfies ChartConfig;

export function AdminFeedbackStatusChart({
  feedbacks,
}: AdminFeedbackStatusChartProps) {
  const chartData = useMemo(() => {
    const pending = feedbacks.filter((item) => item.status === "Pending").length;
    const inProgress = feedbacks.filter(
      (item) => item.status === "In Progress",
    ).length;
    const resolved = feedbacks.filter(
      (item) => item.status === "Resolved",
    ).length;

    return [
      {
        key: "pending",
        name: "Pending",
        total: pending,
        fill: "var(--color-pending)",
      },
      {
        key: "inProgress",
        name: "In Progress",
        total: inProgress,
        fill: "var(--color-inProgress)",
      },
      {
        key: "resolved",
        name: "Resolved",
        total: resolved,
        fill: "var(--color-resolved)",
      },
    ];
  }, [feedbacks]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Feedback Status Chart</CardTitle>
        <CardDescription>
          Live status distribution of your unit submissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="rounded-full bg-accent/10 px-3 py-1 font-medium text-accent">
            All Data
          </div>
          <div className="text-muted-foreground">
            {feedbacks.length} submission{feedbacks.length === 1 ? "" : "s"}{" "}
            across status groups
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent labelKey="name" nameKey="key" />}
            />
            <Pie
              data={chartData}
              dataKey="total"
              nameKey="name"
              innerRadius={56}
              outerRadius={92}
            >
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="key" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
