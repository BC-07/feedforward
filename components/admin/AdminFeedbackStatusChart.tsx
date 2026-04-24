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


const VISIBILITY_ORDER = ["anonymous", "notAnonymous"] as const;

type VisibilityKey = (typeof VISIBILITY_ORDER)[number];

const chartConfig = {
  anonymous: {
    label: "Anonymous",
    color: "#ff9500",
  },
  notAnonymous: {
    label: "Not Anonymous",
    color: "#cc6f00",
  },
} satisfies ChartConfig;

export function AdminFeedbackStatusChart({
  feedbacks,
}: AdminFeedbackStatusChartProps) {
  const chartData = useMemo(() => {
    const totals: Record<VisibilityKey, number> = {
      anonymous: 0,
      notAnonymous: 0,
    };

    feedbacks.forEach((feedback) => {
      const visibilityKey: VisibilityKey = feedback.isAnonymous
        ? "anonymous"
        : "notAnonymous";
      totals[visibilityKey] += 1;
    });

    return VISIBILITY_ORDER.map((visibilityKey) => ({
      visibilityKey,
      total: totals[visibilityKey],
      fill: `var(--color-${visibilityKey})`,
    })).filter((item) => item.total > 0);
  }, [feedbacks]);

  const totalFeedbacks = feedbacks.length;
  const activeVisibilityTypes = chartData.length;

  return (
    <Card className="h-full shadow-lg">
      <CardHeader>
        <CardTitle>Feedback Anonymity Donut Graph</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="rounded-full bg-accent/10 px-3 py-1 font-medium text-accent">
            Visibility Mix
          </div>
          <div className="text-muted-foreground">
            {activeVisibilityTypes} visibility type
            {activeVisibilityTypes === 1 ? "" : "s"}{" "}
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
                    content={<ChartTooltipContent nameKey="visibilityKey" />}
                  />
                  <Pie
                    data={chartData}
                    dataKey="total"
                    nameKey="visibilityKey"
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
                              y={viewBox.cy - 30}
                              className="fill-foreground text-3xl font-semibold"
                            >
                              {totalFeedbacks}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy + -5}
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
                        key={entry.visibilityKey}
                        fill={entry.fill}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={
                      <ChartLegendContent
                        nameKey="visibilityKey"
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
                  Anonymous and non-anonymous feedback totals will appear here
                  once submissions are available.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}