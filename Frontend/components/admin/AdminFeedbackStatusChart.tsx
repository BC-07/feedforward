"use client";

import { useMemo } from "react";
import { Cell, Label, Pie, PieChart } from "recharts";
import type { Feedback } from "@/lib/api";
import {
  Card,
  CardContent,
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

const STATUS_ORDER = ["pending", "inProgress", "resolved", "other"] as const;

type StatusKey = (typeof STATUS_ORDER)[number];

const chartConfig = {
  pending: {
    label: "Pending",
    color: "#ff9500",
  },
  inProgress: {
    label: "In Progress",
    color: "#ffb347",
  },
  resolved: {
    label: "Resolved",
    color: "#cc6f00",
  },
  other: {
    label: "Other",
    color: "#ffd8a8",
  },
} satisfies ChartConfig;

function normalizeStatus(status: string): StatusKey {
  switch (status.trim().toLowerCase()) {
    case "pending":
      return "pending";
    case "in progress":
    case "inprogress":
      return "inProgress";
    case "resolved":
      return "resolved";
    default:
      return "other";
  }
}

export function AdminFeedbackStatusChart({
  feedbacks,
}: AdminFeedbackStatusChartProps) {
  const chartData = useMemo(() => {
    const totals: Record<StatusKey, number> = {
      pending: 0,
      inProgress: 0,
      resolved: 0,
      other: 0,
    };

    feedbacks.forEach((feedback) => {
      totals[normalizeStatus(feedback.status)] += 1;
    });

    return STATUS_ORDER.map((statusKey) => ({
      statusKey,
      total: totals[statusKey],
      fill: `var(--color-${statusKey})`,
    })).filter((item) => item.total > 0);
  }, [feedbacks]);

  const totalFeedbacks = feedbacks.length;
  const activeStatuses = chartData.length;

  return (
    <Card className="h-full shadow-lg">
      <CardHeader>
        <CardTitle>Feedback Status Donut Graph</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="rounded-full bg-accent/10 px-3 py-1 font-medium text-accent">
            Status Mix
          </div>
          <div className="text-muted-foreground">
            {activeStatuses} active status{activeStatuses === 1 ? "" : "es"}{" "}
            across {totalFeedbacks} submission
            {totalFeedbacks === 1 ? "" : "s"}
          </div>
        </div>

        <div className="relative">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <PieChart margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
              {chartData.length ? (
                <>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent nameKey="statusKey" />}
                  />
                  <Pie
                    data={chartData}
                    dataKey="total"
                    nameKey="statusKey"
                    innerRadius={70}
                    outerRadius={96}
                    paddingAngle={4}
                    cornerRadius={8}
                    isAnimationActive={false}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (
                          !viewBox ||
                          !("cx" in viewBox) ||
                          !("cy" in viewBox)
                        ) {
                          return null;
                        }

                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy - 10}
                              className="fill-foreground text-3xl font-semibold"
                            >
                              {totalFeedbacks}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy + 22}
                              className="fill-muted-foreground text-xs tracking-[0.24em]"
                            >
                              TOTAL
                            </tspan>
                          </text>
                        );
                      }}
                    />
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.statusKey}
                        fill={entry.fill}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={
                      <ChartLegendContent
                        nameKey="statusKey"
                        className="flex-wrap gap-4 pt-6"
                      />
                    }
                  />
                </>
              ) : null}
            </PieChart>
          </ChartContainer>

          {!chartData.length ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-40 w-40 items-center justify-center rounded-full border-[18px] border-accent/15 bg-accent/5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-card text-sm font-medium text-muted-foreground">
                    No Data
                  </div>
                </div>
                <span className="max-w-[14rem] text-sm text-muted-foreground">
                  Feedback statuses will appear here once submissions are
                  available.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
