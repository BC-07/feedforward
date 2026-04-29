"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Feedback } from "@/lib/api";

type FeedbackDetailsCardProps = {
  feedback: Feedback;
  title?: string | null;
  formatDate?: (value: string) => string;
  className?: string;
  preSubjectContent?: ReactNode;
  messageVisibleLines?: number;
  compactNoTitleLayout?: boolean;
  hidePriority?: boolean;
  dateLabel?: string;
  dateValue?: string;
  indentMessageFirstLineIfMultiline?: boolean;
  fitMessageToContent?: boolean;
};

const DEFAULT_MESSAGE_VISIBLE_LINES = 5;
const MESSAGE_LINE_HEIGHT_REM = 1.45;

const defaultFormatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const MUTED_TEXT_COLOR = "#6e6e6e";

const getPriorityTextColor = (priority: string) => {
  switch (priority.trim().toLowerCase()) {
    case "low":
      return "#6e6e6e";
    case "medium":
      return "#d97706";
    case "high":
      return "#ea580c";
    default:
      return "#6e6e6e";
  }
};

export function FeedbackDetailsCard({
  feedback,
  title = "Feedback Details",
  formatDate = defaultFormatDate,
  className,
  preSubjectContent,
  messageVisibleLines = DEFAULT_MESSAGE_VISIBLE_LINES,
  compactNoTitleLayout = false,
  hidePriority = false,
  dateLabel = "Last Updated",
  dateValue,
  indentMessageFirstLineIfMultiline = false,
  fitMessageToContent = false,
}: FeedbackDetailsCardProps) {
  const messageViewportHeightRem = messageVisibleLines * MESSAGE_LINE_HEIGHT_REM;
  const renderedDate = formatDate(dateValue ?? feedback.updatedAt);
  const messageRef = useRef<HTMLParagraphElement | null>(null);
  const [isMessageMultiline, setIsMessageMultiline] = useState(false);
  const hasTitle = Boolean(title?.trim());
  const contentClassName = hasTitle
    ? "flex h-full min-h-0 flex-col space-y-2.5 overflow-hidden"
    : compactNoTitleLayout
      ? "space-y-4 overflow-visible pt-4 px-0"
      : "space-y-8 overflow-hidden pt-4";
  const gridClassName = hasTitle
    ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
    : compactNoTitleLayout
      ? "grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2"
      : "grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2";
  const compactMetaItemClass = compactNoTitleLayout ? "space-y-2" : "space-y-1";
  const shouldIndentMessage = indentMessageFirstLineIfMultiline && isMessageMultiline;

  useEffect(() => {
    if (!indentMessageFirstLineIfMultiline) {
      return;
    }

    const node = messageRef.current;
    if (!node) return;

    const calculate = () => {
      const styles = window.getComputedStyle(node);
      const parsedLineHeight = Number.parseFloat(styles.lineHeight);
      const lineHeight = Number.isFinite(parsedLineHeight)
        ? parsedLineHeight
        : Number.parseFloat(styles.fontSize) * 1.45;
      setIsMessageMultiline(node.scrollHeight > lineHeight + 1);
    };

    calculate();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(calculate);
      observer.observe(node);
      return () => observer.disconnect();
    }
  }, [feedback.message, indentMessageFirstLineIfMultiline]);

  return (
    <Card className={["gap-2 shadow-lg", className].filter(Boolean).join(" ")}>
      {hasTitle ? (
        <CardHeader className="pb-1">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={contentClassName}>
        <div className={gridClassName}>
          <div className={hasTitle ? undefined : compactMetaItemClass}>
            <p className="text-xs font-semibold" style={{ color: MUTED_TEXT_COLOR }}>Type</p>
            <p className="mt-0.5 text-[0.98rem] font-medium capitalize">{feedback.type}</p>
          </div>
          <div className={hasTitle ? undefined : compactMetaItemClass}>
            <p className="text-xs font-semibold" style={{ color: MUTED_TEXT_COLOR }}>Category</p>
            <p className="mt-0.5 text-[0.98rem] font-medium">{feedback.category}</p>
          </div>
          {!hidePriority ? (
            <div className={hasTitle ? undefined : compactMetaItemClass}>
              <p className="text-xs font-semibold" style={{ color: MUTED_TEXT_COLOR }}>Priority</p>
              <p
                className="mt-0.5 text-[0.98rem] font-medium capitalize"
                style={{ color: getPriorityTextColor(feedback.priority) }}
              >
                {feedback.priority}
              </p>
            </div>
          ) : null}
          <div className={hasTitle ? "sm:col-span-2" : compactMetaItemClass}>
            <p className="text-xs font-semibold" style={{ color: MUTED_TEXT_COLOR }}>{dateLabel}</p>
            <p className="mt-0.5 text-[0.96rem] font-medium whitespace-nowrap" style={{ color: "#000000" }}>
              {renderedDate}
            </p>
          </div>
        </div>

        {preSubjectContent}

        {compactNoTitleLayout && !hasTitle ? (
          <div className="relative -mx-4 rounded-[1.75rem] bg-background/70 sm:-mx-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20 rounded-[1.75rem] border-2 border-[#c8c8c8] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
            />
            <div className="relative z-10 px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold" style={{ color: MUTED_TEXT_COLOR }}>Subject</p>
              <p className="line-clamp-2 max-w-full text-[1rem] font-semibold [overflow-wrap:anywhere] break-all">
                {feedback.subject}
              </p>
              <p
                ref={messageRef}
                className={`ff-hide-scrollbar mt-2 max-w-full overflow-x-hidden ${
                  fitMessageToContent ? "overflow-y-visible" : "overflow-y-auto"
                } px-1 text-[0.9rem] leading-[1.45rem] [text-align:justify] [text-justify:inter-word] [overflow-wrap:anywhere] break-all hyphens-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                  shouldIndentMessage ? "[text-indent:2rem]" : ""
                }`}
                style={{
                  ...(fitMessageToContent
                    ? {}
                    : { maxHeight: `${messageViewportHeightRem}rem` }),
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                {feedback.message}
              </p>
            </div>
          </div>
        ) : (
          <div className={hasTitle ? "space-y-1" : "space-y-3"}>
            <p className="text-xs font-semibold" style={{ color: MUTED_TEXT_COLOR }}>Subject</p>
            <p className="line-clamp-2 text-[0.98rem] font-semibold break-words">
              {feedback.subject}
            </p>
            <p
              ref={messageRef}
              className="ff-hide-scrollbar mt-0.5 overflow-y-auto px-1 text-[0.9rem] leading-[1.45rem] [text-align:justify] [text-justify:inter-word] [text-indent:1rem] [overflow-wrap:anywhere] break-words hyphens-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{
                height: `${messageViewportHeightRem}rem`,
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {feedback.message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
