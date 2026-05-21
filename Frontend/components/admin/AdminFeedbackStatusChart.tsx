"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { Cell, Label, Pie, PieChart, Sector } from "recharts";
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
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipPos = useRef({ x: 0, y: 0 });
  const tooltipTarget = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const isTooltipVisible = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

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

  const containerRef = useRef<HTMLDivElement>(null);

  const animateTooltip = () => {
    tooltipPos.current.x += (tooltipTarget.current.x - tooltipPos.current.x) * 0.18;
    tooltipPos.current.y += (tooltipTarget.current.y - tooltipPos.current.y) * 0.18;
    if (tooltipRef.current) {
      tooltipRef.current.style.left = tooltipPos.current.x + "px";
      tooltipRef.current.style.top = tooltipPos.current.y + "px";
    }
    if (isTooltipVisible.current) {
      rafId.current = requestAnimationFrame(animateTooltip);
    }
  };

  const showTooltip = (e: React.MouseEvent, label: string, value: number, total: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + 12;
    const y = e.clientY - rect.top - 36;
    isTooltipVisible.current = true;
    tooltipTarget.current = { x, y };
    tooltipPos.current = { x, y };
    if (tooltipRef.current) {
      tooltipRef.current.innerHTML = `<span style="font-weight:500">${label}</span>: ${value} (${Math.round((value / total) * 100)}%)`;
      tooltipRef.current.style.opacity = "1";
      tooltipRef.current.style.transform = "scale(1) translateY(0)";
    }
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(animateTooltip);
  };

  const moveTooltip = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    tooltipTarget.current = { x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 36 };
  };

  const hideTooltip = () => {
    isTooltipVisible.current = false;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = "0";
      tooltipRef.current.style.transform = "scale(0.95) translateY(2px)";
    }
  };

  const totalFeedbacks = feedbacks.length;
  const activeVisibilityTypes = chartData.length;

  return (
    <Card
      ref={cardRef}
      className="h-full shadow-lg transition-all duration-700 ease-out delay-150"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(24px)",
        transitionDelay: isVisible ? "150ms" : "0ms",
      }}
    >
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

        <div ref={containerRef} className="relative">
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-50 rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-md opacity-0"
            style={{ transition: "opacity 0.15s ease, transform 0.15s ease", transform: "scale(0.95) translateY(2px)", whiteSpace: "nowrap" }}
          />
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <PieChart margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
              {chartData.length ? (
                <>
                  <Pie
                    {...({} as any)}
                    data={chartData}
                    dataKey="total"
                    nameKey="visibilityKey"
                    innerRadius={70}
                    outerRadius={96}
                    paddingAngle={4}
                    cornerRadius={8}
                    isAnimationActive={isVisible}
                    animationDuration={900}
                    animationEasing="ease-out"
                    animationBegin={300}
                    onMouseEnter={(data: any, index: number, e: any) => {
                      setActiveIndex(index);
                      showTooltip(
                        e as unknown as React.MouseEvent,
                        chartConfig[data.visibilityKey as keyof typeof chartConfig]?.label ?? data.visibilityKey,
                        data.total,
                        totalFeedbacks,
                      );
                    }}
                    onMouseMove={(_: any, _index: number, e: any) => moveTooltip(e as unknown as React.MouseEvent)}
                    onMouseLeave={() => { setActiveIndex(undefined); hideTooltip(); }}
                    activeIndex={activeIndex}
                    activeShape={(props: any) => {
                      const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                      return (
                        <g>
                          <Sector
                            cx={cx}
                            cy={cy}
                            innerRadius={innerRadius - 4}
                            outerRadius={outerRadius + 6}
                            startAngle={startAngle}
                            endAngle={endAngle}
                            fill={fill}
                            opacity={0.85}
                          />
                        </g>
                      );
                    }}
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