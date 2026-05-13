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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatFilterChipLabel } from "@/lib/filterUtils";
import {
  SUBMISSION_FILTER_CONTROL_CLASS,
  SUBMISSION_FILTER_TEXT_COLOR,
  MY_SUBMISSIONS_PAGE_SIZE_OPTIONS,
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
  filterType: string[];
  filterPriority: string[];
  filterStatus: string[];
  filterTracking: string;
  filterDate: string;
  mySubmissionsPage: number;
  mySubmissionsPageSize: (typeof MY_SUBMISSIONS_PAGE_SIZE_OPTIONS)[number];
  mySubmissionsTotalPages: number;
  submissionsScrollRef: React.RefObject<HTMLDivElement | null>;
  submissionsScrollKey: string;
  submissionsScrollTopRef: React.MutableRefObject<number>;
  mySubmissionsPlaceholderRowCount: number;
  activeFilterChips: FilterChip[];
  activeFilterCount: number;
  hoverFilterItems: HoverFilterItem<HoverFilterKey>[];
  onSearchChange: (value: string) => void;
  onFilterTypeChange: (updater: (prev: string[]) => string[]) => void;
  onFilterPriorityChange: (updater: (prev: string[]) => string[]) => void;
  onFilterStatusChange: (updater: (prev: string[]) => string[]) => void;
  onFilterTrackingChange: (value: string) => void;
  onFilterDateChange: (value: string) => void;
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
  filterType,
  filterPriority,
  filterStatus,
  filterTracking,
  filterDate,
  mySubmissionsPage,
  mySubmissionsPageSize,
  mySubmissionsTotalPages,
  submissionsScrollRef,
  submissionsScrollKey,
  submissionsScrollTopRef,
  mySubmissionsPlaceholderRowCount,
  activeFilterChips,
  activeFilterCount,
  hoverFilterItems,
  onSearchChange,
  onFilterTypeChange,
  onFilterPriorityChange,
  onFilterStatusChange,
  onFilterTrackingChange,
  onFilterDateChange,
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
      <>
        {renderCreateSubmissionDialog()}
        <Card className="h-full border shadow-sm flex flex-col">
          <CardContent className="pt-6 flex-1 flex items-center">
            <div className="text-center py-8 w-full">
              <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="mb-2 text-lg font-normal">
                No Submissions Yet
              </h3>
              <p className="text-black">
                Create your first feedback submission to start tracking it here.
              </p>
              <Button
                type="button"
                onClick={onCreateSubmissionClick}
                className="mt-5 h-9 bg-accent hover:bg-accent/90 transition-colors duration-150 hover:-translate-y-px"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Submission
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="ff-user-dashboard-theme mx-auto flex h-[calc(100vh-7rem)] min-h-0 w-full flex-col gap-2 rounded-[28px] border border-[#e7dfd3] bg-white px-5 py-6 shadow-[0_24px_80px_rgba(34,25,12,0.08)] sm:px-8 sm:py-8">
      {/* Header with title and create button */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex h-9 items-center gap-3">
          <div className="flex h-9 w-11 items-center justify-center rounded-2xl bg-muted/50 text-[#171717]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="flex h-9 items-center">
            <h2 className="text-[21px] font-semibold leading-none tracking-[-0.02em] text-[#171717]">
              Submission List  
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
                className={`${SUBMISSION_FILTER_CONTROL_CLASS} font-normal ff-submission-search-input`}
                style={{ color: SUBMISSION_FILTER_TEXT_COLOR, paddingLeft: "2.75rem" }}
              />
            </div>

            {/* A-Z tracking select */}
            <Select value={filterTracking} onValueChange={onFilterTrackingChange}>
              <SelectTrigger className={`${SUBMISSION_FILTER_CONTROL_CLASS} [&_svg]:text-[#6f6255] font-medium`} style={{ color: SUBMISSION_FILTER_TEXT_COLOR }}>
                <SelectValue placeholder="A - Z" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">A - Z</SelectItem>
                <SelectItem value="desc">Z - A</SelectItem>
              </SelectContent>
            </Select>

            {/* Most Recent date select */}
            <Select value={filterDate} onValueChange={onFilterDateChange}>
              <SelectTrigger className={`${SUBMISSION_FILTER_CONTROL_CLASS} [&_svg]:text-[#6f6255] font-medium`} style={{ color: SUBMISSION_FILTER_TEXT_COLOR }}>
                <SelectValue placeholder="Most Recent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>

            {/* Multi-select Type */}
            <DropdownMenu >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`${SUBMISSION_FILTER_CONTROL_CLASS} flex items-center justify-between gap-2 `}
                  style={{ color: SUBMISSION_FILTER_TEXT_COLOR }}
                >
                  <span className="truncate font-medium" style={{ color: "#171717" }}>
                    {filterType.length === 0 ? "All Types" : formatFilterChipLabel(filterType[filterType.length - 1]!)}
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-[#6f6255]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-1 font-medium">
                {[
                  { value: "suggestion", label: "Suggestion" },
                  { value: "complaint", label: "Complaint" },
                  { value: "inquiry", label: "Inquiry" },
                  { value: "request", label: "Request" },
                  { value: "compliment", label: "Compliment" },
                ].map((option) => {
                  const isSelected = filterType.includes(option.value);
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => onFilterTypeChange((prev) => isSelected ? prev.filter((t) => t !== option.value) : [...prev, option.value])}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer"
                    >
                      <span>{option.label}</span>
                      {isSelected && <svg className="h-4 w-4 text-accent" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Multi-select Priority */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`${SUBMISSION_FILTER_CONTROL_CLASS} flex items-center justify-between gap-2`}
                  style={{ color: SUBMISSION_FILTER_TEXT_COLOR }}
                >
                  <span className="truncate font-medium" style={{ color: "#171717" }}>
                    {filterPriority.length === 0 ? "All Priorities" : formatFilterChipLabel(filterPriority[filterPriority.length - 1]!)}
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-[#6f6255]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-1 font-medium">
                {[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ].map((option) => {
                  const isSelected = filterPriority.includes(option.value);
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => onFilterPriorityChange((prev) => isSelected ? prev.filter((p) => p !== option.value) : [...prev, option.value])}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer"
                    >
                      <span>{option.label}</span>
                      {isSelected && <svg className="h-4 w-4 text-accent" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Multi-select Status */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`${SUBMISSION_FILTER_CONTROL_CLASS} flex items-center justify-between gap-2`}
                  style={{ color: SUBMISSION_FILTER_TEXT_COLOR }}
                >
                  <span className="truncate font-medium" style={{ color: "#171717" }}>
                    {filterStatus.length === 0
                      ? "All Status"
                      : filterStatus[filterStatus.length - 1] === "inprogress"
                        ? "In Progress"
                        : formatFilterChipLabel(filterStatus[filterStatus.length - 1]!)}
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-[#6f6255]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-1 font-medium">
                {[
                  { value: "pending", label: "Pending" },
                  { value: "inprogress", label: "In Progress" },
                  { value: "resolved", label: "Resolved" },
                ].map((option) => {
                  const isSelected = filterStatus.includes(option.value);
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => onFilterStatusChange((prev) => isSelected ? prev.filter((s) => s !== option.value) : [...prev, option.value])}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer"
                    >
                      <span>{option.label}</span>
                      {isSelected && <svg className="h-4 w-4 text-accent" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile filters */}
          <div className="flex w-full gap-2 md:hidden">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by ID, subject, message."
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="font-normal h-8 text-sm border-border/60 bg-background pl-8.5 transition-colors duration-200 focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-transparent"
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
                  className="inline-flex min-h-0 items-center rounded-full border border-[#ddd4c9] bg-white px-3 py-1 text-[11px] font-normal leading-none text-black"
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
                className="inline-flex min-h-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-normal leading-none transition-colors hover:bg-[#f7f3ee] hover:text-[#4d463e]"
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
          submissionsScrollTopRef.current = top;
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(submissionsScrollKey, top.toString());
          }
        }}
      >
        <div className="w-full overflow-x-auto">
          <Table className="w-full min-w-[640px] text-xs sm:text-sm [&_td]:px-2 [&_th]:px-2">
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-black">
                  <div className="w-[120px]">Tracking ID</div>
                </TableHead>
                <TableHead className="text-black">
                  <div className="w-[220px]">Subject</div>
                </TableHead>
                <TableHead className="px-2 text-black">
                  <div className="w-[120px]">Category</div>
                </TableHead>
                <TableHead className="px-1.5 text-black">
                  <div className="w-[90px]">Priority</div>
                </TableHead>
                <TableHead className="px-2 text-black">
                  <div className="w-[100px]">Status</div>
                </TableHead>
                <TableHead className="whitespace-nowrap px-2 text-black">
                  <div className="w-[100px]">Date</div>
                </TableHead>
                <TableHead className="w-[60px] text-center text-black">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedbacks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-black"
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
                    <TableCell className="text-xs" style={{ color: "#666666" }}>
                      <div className="w-[120px] truncate">{feedback.id}</div>
                    </TableCell>
                    <TableCell
                      className="font-normal text-[#6b7280]"
                      title={feedback.subject}
                    >
                      <div className="w-[220px] truncate">{feedback.subject}</div>
                    </TableCell>
                    <TableCell
                      className="px-2"
                      title={feedback.category}
                    >
                      <div className="w-[120px] max-w-[120px] truncate">
                        {feedback.category}
                      </div>
                    </TableCell>
                    <TableCell className="px-1.5">
                      <div className="w-[90px]">
                        <Badge
                          className={getPriorityColor(feedback.priority)}
                          variant="outline"
                        >
                          {feedback.priority}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-2">
                      <div className="w-[100px] truncate">
                        <span className="inline-flex items-center gap-2">
                        {(() => {
                          const StatusIcon = getStatusIcon(feedback.status);
                          return (
                            <Badge
                              variant="outline"
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-normal ${getStatusBadgeClass(
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
                      </div>
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap px-2"
                      style={{ color: "#666666" }}
                    >
                      <div className="w-[100px] whitespace-nowrap">
                        {formatSubmittedAt(feedback.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="w-[60px] text-center">
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
            statusText={
              <>
                <span className="text-sm">
                Viewing{" "}
                <span className="font-normal">
                  {paginatedFilteredFeedbacks.length}
                </span>{" "}
                out of{" "}
                <span className="font-normal">
                  {filteredFeedbacks.length}
                </span>{" "}
                submission{filteredFeedbacks.length !== 1 ? "s" : ""}
                </span>
              </>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
