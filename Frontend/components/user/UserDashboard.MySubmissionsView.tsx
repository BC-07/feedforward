"use client";

import React from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Plus,
  Search,
  X,
  Trash2,
  MessageCircle,
} from "lucide-react";
import {
  HoverFilterPopover,
  type HoverFilterItem,
} from "@/components/filters/HoverFilterPopover";
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer";
import type { Feedback } from "@/lib/api";
import {
  SUBMISSION_FILTER_CONTROL_CLASS,
  SUBMISSION_FILTER_TEXT_COLOR,
  MY_SUBMISSIONS_PAGE_SIZE_OPTIONS,
  USER_DASHBOARD_SUBMISSIONS_SCROLL_KEY,
  type HoverFilterKey,
} from "./constants";

interface FilterChip {
  key: string;
  label: string;
}

interface UserDashboardMySubmissionsViewProps {
  feedbacks: Feedback[];
  filteredFeedbacks: Feedback[];
  paginatedFilteredFeedbacks: Feedback[];
  searchQuery: string;
  mySubmissionsPage: number;
  mySubmissionsPageSize: (typeof MY_SUBMISSIONS_PAGE_SIZE_OPTIONS)[number];
  mySubmissionsTotalPages: number;
  submissionsScrollRef: React.RefObject<HTMLDivElement>;
  submissionsScrollKey: string;
  submissionsScrollTop: React.MutableRefObject<number>;
  mySubmissionsPlaceholderRowCount: number;
  activeFilterChips: FilterChip[];
  activeFilterCount: number;
  hoverFilterItems: HoverFilterItem<HoverFilterKey>[];
  desktopInlineFilterItems: HoverFilterItem<HoverFilterKey>[];
  onSearchChange: (value: string) => void;
  onViewFeedback: (feedback: Feedback) => void;
  onCreateSubmissionClick: () => void;
  onDeleteClick: (feedback: Feedback) => void;
  onClearSingleFilter: (key: string) => void;
  onClearAllFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: (typeof MY_SUBMISSIONS_PAGE_SIZE_OPTIONS)[number]) => void;
  renderCreateSubmissionDialog: () => React.ReactNode;
  getPriorityColor: (priority: string) => string;
  getStatusBadgeClass: (status: string) => string;
  getStatusIcon: (status: string) => React.ComponentType<React.SVGProps<SVGSVGElement>>;
  formatSubmittedAt: (date: string) => string;
}

export function UserDashboardMySubmissionsView({
  feedbacks,
  filteredFeedbacks,
  paginatedFilteredFeedbacks,
  searchQuery,
  mySubmissionsPage,
  mySubmissionsPageSize,
  mySubmissionsTotalPages,
  submissionsScrollRef,
  submissionsScrollKey,
  submissionsScrollTop,
  mySubmissionsPlaceholderRowCount,
  activeFilterChips,
  activeFilterCount,
  hoverFilterItems,
  desktopInlineFilterItems,
  onSearchChange,
  onViewFeedback,
  onCreateSubmissionClick,
  onDeleteClick,
  onClearSingleFilter,
  onClearAllFilters,
  onPageChange,
  onPageSizeChange,
  renderCreateSubmissionDialog,
  getPriorityColor,
  getStatusBadgeClass,
  getStatusIcon,
  formatSubmittedAt,
}: UserDashboardMySubmissionsViewProps) {
  if (feedbacks.length === 0) {
    return (
      <Card className="h-full border shadow-sm flex flex-col">
        <CardContent className="pt-6 flex-1 flex items-center">
          <div className="text-center py-8 w-full">
            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No Submissions Yet
            </h3>
            <p className="text-muted-foreground">
              No submissions yet. Use Submit Feedback to create your first one.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full flex-col gap-2 rounded-[28px] border border-[#e7dfd3] bg-white px-5 py-6 shadow-[0_24px_80px_rgba(34,25,12,0.08)] sm:px-8 sm:py-8">
      {/* Header with title and create button */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex h-9 items-center gap-3">
          <div className="flex h-9 w-11 items-center justify-center rounded-2xl bg-muted/50 text-[#171717]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="flex h-9 items-center">
            <h2 className="text-[21px] font-semibold leading-none tracking-[-0.02em] text-[#171717]">
              Submission list
            </h2>
          </div>
        </div>
        <Button
          type="button"
          onClick={onCreateSubmissionClick}
          className="h-9 sm:w-auto bg-accent hover:bg-accent/90 transition-colors duration-150 hover:-translate-y-px"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Submission
        </Button>
      </div>

      {/* Filters and search */}
      <div>
        <div className="mb-3">
          {/* Desktop filters */}
          <div className="hidden gap-x-3 gap-y-2 md:grid xl:grid-cols-[minmax(0,1.9fr)_repeat(5,minmax(0,1fr))]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "#8f877d" }}
              />
              <Input
                placeholder="Search by ID, subject, or message."
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className={`${SUBMISSION_FILTER_CONTROL_CLASS} placeholder:text-[#8f877d]`}
                style={{
                  color: SUBMISSION_FILTER_TEXT_COLOR,
                  paddingLeft: "2.75rem",
                }}
              />
            </div>
            {desktopInlineFilterItems.map((filter) => (
              <Select
                key={filter.key}
                value={(() => {
                  switch (filter.key) {
                    case "tracking":
                      return hoverFilterItems.find(f => f.key === "tracking")?.options.find(o => o.value === searchQuery)?.value || "asc";
                    default:
                      return filter.options[0]?.value || "";
                  }
                })()}
                onValueChange={filter.onSelect}
              >
                <SelectTrigger
                  className={`${SUBMISSION_FILTER_CONTROL_CLASS} [&_svg]:text-[#6f6255]`}
                  style={{
                    color: SUBMISSION_FILTER_TEXT_COLOR,
                  }}
                >
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem
                      key={`${filter.key}-${option.value}`}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>

          {/* Mobile filters */}
          <div className="flex w-full gap-2 md:hidden">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by ID, subject, message."
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-8 text-sm border-border/60 bg-background pl-8.5 transition-colors duration-200 focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-transparent"
              />
            </div>
            <HoverFilterPopover
              items={hoverFilterItems}
              activeCount={activeFilterCount}
              onReset={onClearAllFilters}
            />
          </div>

          {/* Active filter chips */}
          {activeFilterChips.length > 0 ? (
            <div className="mt-5 mb-3 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex min-h-0 items-center rounded-full border border-[#ddd4c9] bg-white px-3 py-1 text-[11px] font-medium leading-none text-[#6f6255]"
                  style={{ columnGap: "12px" }}
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={() => onClearSingleFilter(chip.key)}
                    className="inline-flex items-center justify-center rounded-full p-0.5 text-[#6f6255] transition-colors hover:bg-[#efe5da] hover:text-[#4d463e]"
                    aria-label={`Remove ${chip.label} filter`}
                    title={`Remove ${chip.label} filter`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={onClearAllFilters}
                className="inline-flex min-h-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium leading-none transition-colors hover:bg-[#f7f3ee] hover:text-[#4d463e]"
                style={{ color: "#171717" }}
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Create submission dialog */}
      {renderCreateSubmissionDialog()}

      {/* Scrollable table */}
      <div
        ref={submissionsScrollRef}
        className="ff-hide-scrollbar flex-1 min-h-0 w-full max-w-full overflow-y-scroll overflow-x-hidden md:[scrollbar-gutter:stable] h-[calc(100vh-260px)]"
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          submissionsScrollTop.current = top;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(submissionsScrollKey, top.toString());
          }
        }}
      >
        <div className="w-full overflow-x-auto">
          <Table className="w-full min-w-full md:min-w-[980px] md:table-fixed text-xs sm:text-sm [&_td]:px-3 [&_th]:px-3">
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[150px]">
                  Tracking ID
                </TableHead>
                <TableHead className="w-[300px]">
                  Subject
                </TableHead>
                <TableHead className="w-[220px]">
                  Category
                </TableHead>
                <TableHead className="w-[110px]">
                  Priority
                </TableHead>
                <TableHead className="w-[150px]">
                  Status
                </TableHead>
                <TableHead className="w-[130px] whitespace-nowrap">
                  Date
                </TableHead>
                <TableHead className="w-[88px] text-center">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedbacks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No submissions match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedFilteredFeedbacks.map((feedback) => (
                  <TableRow
                    key={feedback.id}
                    className="h-14 cursor-pointer"
                    onClick={() => onViewFeedback(feedback)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground truncate">
                      {feedback.id}
                    </TableCell>
                    <TableCell
                      className="font-medium truncate"
                      title={feedback.subject}
                    >
                      {feedback.subject}
                    </TableCell>
                    <TableCell
                      className="truncate"
                      title={feedback.category}
                    >
                      {feedback.category}
                    </TableCell>
                    <TableCell className="truncate">
                      <Badge
                        className={getPriorityColor(feedback.priority)}
                        variant="outline"
                      >
                        {feedback.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {(() => {
                          const StatusIcon = getStatusIcon(feedback.status);
                          return (
                            <Badge
                              variant="outline"
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClass(
                                feedback.status,
                              )}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />
                              <span className="leading-none">
                                {feedback.status}
                              </span>
                            </Badge>
                          );
                        })()}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatSubmittedAt(feedback.createdAt)}
                    </TableCell>
                    <TableCell className="w-[88px] text-center">
                      {feedback.status.toLowerCase() === "pending" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-rose-600 hover:bg-rose-600 hover:text-white"
                          aria-label="Delete submission"
                          title="Delete submission"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteClick(feedback);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="inline-flex h-7 w-7 items-center justify-center text-xs text-muted-foreground">
                          -
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {filteredFeedbacks.length > 0 && mySubmissionsPlaceholderRowCount > 0
                ? Array.from({ length: mySubmissionsPlaceholderRowCount }).map(
                    (_, index) => (
                      <TableRow
                        key={`submission-placeholder-row-${index}`}
                        className="h-14"
                        aria-hidden="true"
                      >
                        <TableCell colSpan={7} />
                      </TableRow>
                    ),
                  )
                : null}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination footer */}
      {filteredFeedbacks.length > 0 ? (
        <div className="shrink-0 border-t border-border/60 bg-background pt-3">
          <TablePaginationFooter
            page={mySubmissionsPage}
            totalPages={mySubmissionsTotalPages}
            onPrevious={() =>
              onPageChange(Math.max(1, mySubmissionsPage - 1))
            }
            onNext={() =>
              onPageChange(Math.min(mySubmissionsTotalPages, mySubmissionsPage + 1))
            }
            pageSize={mySubmissionsPageSize}
            pageSizeOptions={MY_SUBMISSIONS_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(value) =>
              onPageSizeChange(
                value as typeof mySubmissionsPageSize,
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}
