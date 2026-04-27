"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { Feedback } from "@/lib/api";
import {
  Card,
  CardContent,
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
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

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
    <Card
      ref={cardRef}
      className="h-full shadow-lg transition-all duration-700 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(24px)",
      }}
    >
      <CardHeader>
        <CardTitle>Feedback Type Bar Graph</CardTitle>
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

        <div ref={chartRef} className="relative">
          <div
            className="pointer-events-none absolute z-10 rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: tooltip?.x ?? 0,
              top: tooltip?.y ?? 0,
              transform: "translate(-50%, -100%)",
              opacity: tooltipVisible ? 1 : 0,
              transition: "opacity 0.15s ease",
              visibility: tooltip ? "visible" : "hidden",
            }}
          >
            <span className="font-medium">{tooltip?.label}</span>
            {tooltip && <>: {tooltip.value} submission{tooltip.value !== 1 ? "s" : ""}</>}
          </div>
          <ChartContainer config={chartConfig} className="h-[235] w-full">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 16, left: 1, bottom: 1 }}
              onMouseLeave={() => { setHoveredBar(null); setTooltipVisible(false); hideTimer.current = setTimeout(() => setTooltip(null), 150); }}
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
                radius={[10, 10, 0, 0]}
                maxBarSize={84}
                activeBar={false}
                isAnimationActive={isVisible}
                animationDuration={700}
                animationEasing="ease-out"
                animationBegin={200}
                onMouseEnter={(data: any, _index, event) => {
                  if (hideTimer.current) clearTimeout(hideTimer.current);
                  setHoveredBar(data.type ?? null);
                  const chartEl = chartRef.current;
                  if (!chartEl || !event) return;
                  const rect = chartEl.getBoundingClientRect();
                  const target = event.target as SVGElement;
                  const barRect = target.getBoundingClientRect();
                  setTooltip({
                    x: barRect.left + barRect.width / 2 - rect.left,
                    y: barRect.top - rect.top - 8,
                    label: data.type,
                    value: data.total,
                  });
                  setTooltipVisible(true);
                }}
                onMouseLeave={() => {
                  setHoveredBar(null);
                  setTooltipVisible(false);
                  hideTimer.current = setTimeout(() => setTooltip(null), 150);
                }}
                shape={(props: any) => {
                  const { x, y, width, height, value, type } = props;
                  const isHovered = hoveredBar === type;
                  const fill = isHovered ? "#e08800" : "var(--color-total)";
                  const scaleY = isHovered ? 1.04 : 1;
                  const adjustedY = y + height - height * scaleY;
                  const adjustedHeight = height * scaleY;
                  const labelY = adjustedY - 6;
                  return (
                    <g>
                      {adjustedHeight > 0 && (
                        <rect
                          x={x}
                          y={adjustedY}
                          width={width}
                          height={adjustedHeight}
                          fill={fill}
                          rx={10}
                          ry={10}
                          style={{ transition: "fill 0.15s", cursor: "pointer" }}
                        />
                      )}
                      <text
                        x={x + width / 2}
                        y={labelY}
                        textAnchor="middle"
                        fontSize={12}
                        className="fill-foreground"
                        style={{ userSelect: "none", pointerEvents: "none" }}
                      >
                        {value}
                      </text>
                    </g>
                  );
                }}
              >
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}