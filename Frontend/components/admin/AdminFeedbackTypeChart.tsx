"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
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
  type ChartConfig,
} from "@/components/ui/chart";

interface AdminFeedbackTypeChartProps {
  feedbacks: Feedback[];
}

const chartConfig = {
  total: {
    label: "Submissions",
    color: "#ff9500",
  },
} satisfies ChartConfig;

const FEEDBACK_TYPE_ORDER = [
  "suggestion",
  "complaint",
  "inquiry",
  "request",
  "compliment",
] as const;

function formatTypeLabel(type: string) {
  return type
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function AdminFeedbackTypeChart({
  feedbacks,
}: AdminFeedbackTypeChartProps) {
  const chartData = useMemo(() => {
    const totalsByType = feedbacks.reduce<Record<string, number>>(
      (accumulator, feedback) => {
        if (!feedback.type) return accumulator;
        const normalizedType = feedback.type.trim().toLowerCase();
        if (!normalizedType) return accumulator;
        accumulator[normalizedType] = (accumulator[normalizedType] || 0) + 1;
        return accumulator;
      },
      {},
    );

    const orderedTypes = [
      ...FEEDBACK_TYPE_ORDER,
      ...Object.keys(totalsByType).filter(
        (type) =>
          !FEEDBACK_TYPE_ORDER.includes(
            type as (typeof FEEDBACK_TYPE_ORDER)[number],
          ),
      ),
    ];

    return orderedTypes.map((type) => ({
        type: formatTypeLabel(type),
        total: totalsByType[type] || 0,
      }));
  }, [feedbacks]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Feedback Type Bar Graph</CardTitle>
        <CardDescription>
          Live submission counts by feedback type from the database for your
          unit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="rounded-full bg-accent/10 px-3 py-1 font-medium text-accent">
            All Data
          </div>
          <div className="text-muted-foreground">
            {feedbacks.length} submission{feedbacks.length === 1 ? "" : "s"}{" "}
            across all feedback types
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            data={chartData}
            margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="type"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Bar
              dataKey="total"
              fill="var(--color-total)"
              radius={[10, 10, 0, 0]}
              maxBarSize={84}
              activeBar={false}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="total"
                position="top"
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
