"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import {
  createFeedbackMessage,
  getFeedback,
  listFeedbackMessages,
  listFeedbacks,
  updateFeedback,
  type Feedback,
  type FeedbackMessage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatLocalTime } from "@/lib/time";
import { parseAdminResponses } from "@/lib/responseLog";
import { toastApiError } from "@/lib/errorHandling";
import { formatFilterChipLabel } from "@/lib/filterUtils";
import { formatFeedbackText } from "@/lib/textFormat";
import { FeedbackDetailsCard } from "@/components/feedback/FeedbackDetailsCard";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  Pencil,
  Search,
  SendHorizontal,
  X,
} from "lucide-react";
import {
  OPEN_FEEDBACK_EVENT,
} from "./constants";
import type { AdminSessionInfo } from "./useAdminSession";

interface AdminFeedbackWorkspaceProps {
  currentAdmin: AdminSessionInfo | null;
}

interface ReplyComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  isSendingMessage: boolean;
  onSend: (draft: string) => Promise<boolean>;
}

const FEEDBACKS_PER_PAGE = 7;
const CONVERSATION_MESSAGE_MAX_LENGTH = 2000;
const EXPORT_LOGO_PATH = "/favicon.ico";
const ADMIN_FEEDBACK_DETAIL_LAYOUT: "split" | "modal" = "split";
type AdminHoverFilterKey = "name" | "date" | "type" | "priority" | "status";
const ADMIN_FILTER_TEXT_COLOR = "#171717";
const ADMIN_FILTER_MUTED_COLOR = "#8f877d";
const ADMIN_FILTER_CONTROL_CLASS =
  "!h-9 min-h-9 w-full rounded-[12px] border border-[#eceae5] bg-muted/50 px-4 text-[14px] font-semibold text-[#171717] shadow-none transition-colors focus-visible:border-[#e0ddd6] focus-visible:ring-0 focus-visible:ring-transparent";
const ADMIN_FILTER_CHIP_CLASS =
  "inline-flex min-h-0 items-center rounded-full border border-[#ddd4c9] bg-white px-3 py-1 text-[11px] font-medium leading-none text-[#6f6255]";

function markAdminNotificationAsRead(
  adminId: string,
  unit: string,
  feedbackId: string,
) {
  if (typeof window === "undefined") return;
  if (!adminId.trim() || !unit.trim() || !feedbackId.trim()) return;

  const key = `adminNotificationsRead:${adminId}:${unit}`;
  const stored = localStorage.getItem(key);
  const nextReadIds = new Set<string>();

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        parsed
          .filter((value): value is string => typeof value === "string")
          .forEach((value) => nextReadIds.add(value));
      }
    } catch {
      // Ignore malformed stored read-state.
    }
  }

  nextReadIds.add(feedbackId);
  localStorage.setItem(key, JSON.stringify(Array.from(nextReadIds)));
  window.dispatchEvent(new Event("feedforward:session-change"));
}

function normalizeStatusFilterValue(value: string) {
  switch (value) {
    case "pending":
      return "Pending";
    case "inprogress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    default:
      return undefined;
  }
}

const ReplyComposer = memo(function ReplyComposer({
  draft,
  onDraftChange,
  isSendingMessage,
  onSend,
}: ReplyComposerProps) {
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const input = replyInputRef.current;
    if (!input) return;

    input.style.height = "0px";
    const nextHeight = Math.min(Math.max(input.scrollHeight, 36), 72);
    input.style.height = `${nextHeight}px`;
  }, [draft]);

  const submitMessage = useCallback(async () => {
    const sent = await onSend(draft);
    if (!sent) return;

    onDraftChange("");
    window.requestAnimationFrame(() => {
      replyInputRef.current?.focus();
    });
  }, [draft, onDraftChange, onSend]);

  return (
    <div className="bg-background/90 px-3 pb-3 pt-2 backdrop-blur-sm">
      <div className="flex items-end gap-2 rounded-[24px] bg-white/80">
        <Textarea
          ref={replyInputRef}
          id="message"
          placeholder="Type your reply..."
          rows={1}
          value={draft}
          onChange={(event) =>
            onDraftChange(event.target.value.slice(0, CONVERSATION_MESSAGE_MAX_LENGTH))
          }
          maxLength={CONVERSATION_MESSAGE_MAX_LENGTH}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submitMessage();
            }
          }}
          className="ff-hide-scrollbar w-full max-w-full min-w-0 min-h-9 max-h-[72px] flex-1 resize-none overflow-y-auto rounded-full border-0 bg-[#eef4ff] px-4 py-2 text-sm shadow-none [field-sizing:fixed] [max-inline-size:100%] [overflow-wrap:anywhere] [word-break:break-word] [white-space:pre-wrap] placeholder:text-[#6b7280] focus-visible:ring-0 focus-visible:ring-transparent"
          disabled={isSendingMessage}
        />
        <Button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void submitMessage()}
          disabled={isSendingMessage || !draft.trim()}
          aria-label={isSendingMessage ? "Sending reply" : "Send reply"}
          className="h-9 w-9 shrink-0 rounded-full border-0 bg-[#eef4ff] p-0 text-[#9ca3af] shadow-none hover:bg-[#e4edff] hover:text-[#6b7280] disabled:bg-[#eef4ff] disabled:text-[#c4cad4]"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

export function AdminFeedbackWorkspace({
  currentAdmin,
}: AdminFeedbackWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isFeedbacksLoading, setIsFeedbacksLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null,
  );
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUnsentMessageDialogOpen, setIsUnsentMessageDialogOpen] =
    useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterName, setFilterName] = useState("asc");
  const [filterDate, setFilterDate] = useState("recent");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<"details" | "manage">(
    "details",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const openedFeedbackRequestRef = useRef("");
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const splitDetailContentRef = useRef<HTMLDivElement>(null);
  const previousSelectedFeedbackIdRef = useRef<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const trimmedSearchQuery = searchQuery.trim();
  const isSplitPaneLayout = ADMIN_FEEDBACK_DETAIL_LAYOUT === "split";
  const isSplitPaneOpen = isSplitPaneLayout && Boolean(selectedFeedback);
  const requestedFeedbackId = searchParams.get("feedbackId")?.trim() || "";
  const requestedFeedbackOpenToken = searchParams.get("open")?.trim() || "";
  const hasFeedbackChanges = selectedFeedback
    ? newStatus !== selectedFeedback.status ||
      newPriority !== selectedFeedback.priority
    : false;
  const formatDetailsUpdatedAt = useCallback((value: string) => {
    const date = new Date(value);
    const datePart = date.toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${datePart} at ${timePart}`;
  }, []);

  const loadMessages = useCallback(async (feedbackId: string) => {
    setIsMessagesLoading(true);
    try {
      const data = await listFeedbackMessages(feedbackId);
      setMessages(data);
    } catch (error) {
      toastApiError(error, "Failed to load messages.");
    } finally {
      setIsMessagesLoading(false);
    }
  }, []);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = messageScrollRef.current;
    if (!container) return;

    window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    });
  }, []);

  const loadFeedbacks = useCallback(async () => {
    if (!currentAdmin?.unit) return;

    setIsFeedbacksLoading(true);
    try {
      const data = await listFeedbacks({
        category: currentAdmin.unit,
        search: deferredSearchQuery.trim() || undefined,
        type: filterType === "all" ? undefined : filterType,
        status: normalizeStatusFilterValue(filterStatus),
        priority: filterPriority === "all" ? undefined : filterPriority,
      });
      startTransition(() => {
        setFeedbacks(data);
      });
    } catch (error) {
      toastApiError(error, "Failed to load feedback submissions.");
    } finally {
      setIsFeedbacksLoading(false);
    }
  }, [
    currentAdmin?.unit,
    deferredSearchQuery,
    filterPriority,
    filterStatus,
    filterType,
  ]);

  useEffect(() => {
    void loadFeedbacks();
  }, [loadFeedbacks]);

  useEffect(() => {
    if (!isSplitPaneLayout) return;

    const currentId = selectedFeedback?.id ?? null;
    const previousId = previousSelectedFeedbackIdRef.current;
    const content = splitDetailContentRef.current;

    if (currentId && previousId && currentId !== previousId && content) {
      content.getAnimations().forEach((animation) => animation.cancel());
      content.animate(
        [
          { opacity: 0.86, transform: "translateX(12px)" },
          { opacity: 1, transform: "translateX(0)" },
        ],
        {
          duration: 1000,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    }

    previousSelectedFeedbackIdRef.current = currentId;
  }, [isSplitPaneLayout, selectedFeedback?.id]);

  const openFeedbackDialog = useCallback(
    async (feedback: Feedback) => {
      setMessageDraft("");
      setSelectedFeedback(feedback);
      setNewStatus(feedback.status);
      setNewPriority(feedback.priority);
      setIsEditDialogOpen(true);
      await loadMessages(feedback.id);
      if (currentAdmin?.id && currentAdmin.unit) {
        markAdminNotificationAsRead(
          currentAdmin.id,
          currentAdmin.unit,
          feedback.id,
        );
      }
    },
    [currentAdmin, loadMessages],
  );

  const openFeedbackById = useCallback(
    async (feedbackId: string) => {
      if (!feedbackId.trim()) return;

      const localMatch = feedbacks.find((item) => item.id === feedbackId);
      if (localMatch) {
        await openFeedbackDialog(localMatch);
        return;
      }

      try {
        const fresh = await getFeedback(feedbackId);
        if (
          currentAdmin?.unit &&
          fresh.category.toLowerCase() !== currentAdmin.unit.toLowerCase()
        ) {
          return;
        }
        await openFeedbackDialog(fresh);
      } catch (error) {
        toastApiError(error, "Failed to open feedback.");
      }
    },
    [currentAdmin?.unit, feedbacks, openFeedbackDialog],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOpenFeedback = (event: Event) => {
      const customEvent = event as CustomEvent<{ feedbackId?: string }>;
      const feedbackId = customEvent.detail?.feedbackId;
      if (!feedbackId) return;
      void openFeedbackById(feedbackId);
    };

    window.addEventListener(
      OPEN_FEEDBACK_EVENT,
      handleOpenFeedback as EventListener,
    );
    return () => {
      window.removeEventListener(
        OPEN_FEEDBACK_EVENT,
        handleOpenFeedback as EventListener,
      );
    };
  }, [openFeedbackById]);

  useEffect(() => {
    if (!currentAdmin?.unit || !requestedFeedbackId) return;
    const requestKey = requestedFeedbackOpenToken
      ? `${requestedFeedbackId}:${requestedFeedbackOpenToken}`
      : requestedFeedbackId;
    if (openedFeedbackRequestRef.current === requestKey) return;

    openedFeedbackRequestRef.current = requestKey;
    void openFeedbackById(requestedFeedbackId);
    router.replace("/dashboard/feedback-submission", { scroll: false });
  }, [
    currentAdmin?.unit,
    openFeedbackById,
    requestedFeedbackId,
    requestedFeedbackOpenToken,
    router,
  ]);

  const handleSendMessage = useCallback(async (draft: string) => {
    if (!selectedFeedback) return false;
    if (isSendingMessage) return false;
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("Please enter a message.");
      return false;
    }
    if (trimmed.length > CONVERSATION_MESSAGE_MAX_LENGTH) {
      toast.error(`Message must be ${CONVERSATION_MESSAGE_MAX_LENGTH} characters or less.`);
      return false;
    }

    setIsSendingMessage(true);
    try {
      const created = await createFeedbackMessage(selectedFeedback.id, {
        message: trimmed,
      });
      const normalizedCreated: FeedbackMessage =
        currentAdmin && (!created.senderRole || created.senderRole === "user")
          ? {
              ...created,
              senderRole: "admin",
              senderId: currentAdmin.id || created.senderId,
              senderName: currentAdmin.name || created.senderName,
            }
          : created;
      setMessages((prev) => [...prev, normalizedCreated]);
      setMessageDraft("");
      scrollMessagesToBottom("smooth");
      return true;
    } catch (error) {
      toastApiError(error, "Failed to send message.");
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    currentAdmin,
    isSendingMessage,
    setMessageDraft,
    scrollMessagesToBottom,
    selectedFeedback,
  ]);

  const closeEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setSelectedFeedback(null);
    setMessages([]);
    setMessageDraft("");
  }, []);

  const handleAttemptCloseEditDialog = useCallback(() => {
    if (messageDraft.trim().length > 0) {
      setIsUnsentMessageDialogOpen(true);
      return;
    }

    closeEditDialog();
  }, [closeEditDialog, messageDraft]);

  useEffect(() => {
    if (!isEditDialogOpen || !selectedFeedback) return;
    if (isMessagesLoading) return;
    scrollMessagesToBottom();
  }, [
    isEditDialogOpen,
    isMessagesLoading,
    messages.length,
    selectedFeedback,
    scrollMessagesToBottom,
  ]);

  const handleUpdateFeedback = async () => {
    if (!selectedFeedback) return;
    if (!hasFeedbackChanges) {
      toast("No changes to update.");
      return;
    }

    try {
      const payload: Partial<Feedback> = {
        status: newStatus || selectedFeedback.status,
        priority: newPriority || selectedFeedback.priority,
      };
      await updateFeedback(selectedFeedback.id, payload);
      if (currentAdmin?.id && currentAdmin.unit) {
        markAdminNotificationAsRead(
          currentAdmin.id,
          currentAdmin.unit,
          selectedFeedback.id,
        );
      }
      await loadFeedbacks();
      toast.success("Feedback updated successfully.");
      setSelectedFeedback(null);
      setMessages([]);
      setNewStatus("");
      setNewPriority("");
      setIsEditDialogOpen(false);
    } catch (error) {
      toastApiError(error, "Failed to update feedback.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "in progress":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "resolved":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "low":
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-700 border-orange-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setFilterName("asc");
    setFilterDate("recent");
    setFilterType("all");
    setFilterPriority("all");
    setFilterStatus("all");
  }, []);

  const hasActiveFilters =
    trimmedSearchQuery.length > 0 ||
    filterName !== "asc" ||
    filterDate !== "recent" ||
    filterType !== "all" ||
    filterPriority !== "all" ||
    filterStatus !== "all";

  const inlineFilterChips = useMemo(
    () =>
      [
        {
          key: "name" as const,
          value: filterName,
          chipLabel: filterName === "desc" ? "Z - A" : "A - Z",
          showChip: filterName !== "asc",
          options: [
            { value: "asc", label: "A - Z" },
            { value: "desc", label: "Z - A" },
          ],
          onChange: setFilterName,
        },
        {
          key: "date" as const,
          value: filterDate,
          chipLabel: filterDate === "oldest" ? "Oldest" : "Most Recent",
          showChip: filterDate !== "recent",
          options: [
            { value: "recent", label: "Most Recent" },
            { value: "oldest", label: "Oldest" },
          ],
          onChange: setFilterDate,
        },
        {
          key: "type" as const,
          value: filterType,
          chipLabel:
            filterType === "all" ? "All Types" : formatFilterChipLabel(filterType),
          showChip: filterType !== "all",
          options: [
            { value: "all", label: "All Types" },
            { value: "suggestion", label: "Suggestion" },
            { value: "complaint", label: "Complaint" },
            { value: "inquiry", label: "Inquiry" },
            { value: "request", label: "Request" },
            { value: "compliment", label: "Compliment" },
          ],
          onChange: setFilterType,
        },
        {
          key: "priority" as const,
          value: filterPriority,
          chipLabel:
            filterPriority === "all"
              ? "All Priorities"
              : formatFilterChipLabel(filterPriority),
          showChip: filterPriority !== "all",
          options: [
            { value: "all", label: "All Priorities" },
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ],
          onChange: setFilterPriority,
        },
        {
          key: "status" as const,
          value: filterStatus,
          chipLabel:
            filterStatus === "all"
              ? "All Status"
              : filterStatus === "inprogress"
                ? "In Progress"
                : formatFilterChipLabel(filterStatus),
          showChip: filterStatus !== "all",
          options: [
            { value: "all", label: "All Status" },
            { value: "pending", label: "Pending" },
            { value: "inprogress", label: "In Progress" },
            { value: "resolved", label: "Resolved" },
          ],
          onChange: setFilterStatus,
        },
      ] satisfies Array<{
        key: AdminHoverFilterKey;
        value: string;
        chipLabel: string;
        showChip: boolean;
        options: { value: string; label: string }[];
        onChange: (value: string) => void;
      }>,
    [filterDate, filterName, filterPriority, filterStatus, filterType],
  );
  const activeFilterPills = useMemo(
    () =>
      [
        trimmedSearchQuery
          ? { key: "search", label: searchQuery.trim() }
          : null,
        filterName !== "asc" ? { key: "name", label: "Z - A" } : null,
        filterDate !== "recent"
          ? { key: "date", label: "Oldest" }
          : null,
        filterType !== "all"
          ? { key: "type", label: formatFilterChipLabel(filterType) }
          : null,
        filterPriority !== "all"
          ? {
              key: "priority",
              label: formatFilterChipLabel(filterPriority),
            }
          : null,
        filterStatus !== "all"
          ? {
              key: "status",
              label:
                filterStatus === "inprogress"
                  ? "In Progress"
                  : formatFilterChipLabel(filterStatus),
            }
          : null,
      ].filter((pill): pill is { key: string; label: string } => Boolean(pill)),
    [
      filterDate,
      filterName,
      filterPriority,
      filterStatus,
      filterType,
      searchQuery,
      trimmedSearchQuery,
    ],
  );
  const splitPaneTopShift = activeFilterPills.length > 0 ? "-154px" : "-102px";

  const clearSingleFilter = useCallback((key: string) => {
    switch (key) {
      case "search":
        setSearchQuery("");
        break;
      case "name":
        setFilterName("asc");
        break;
      case "date":
        setFilterDate("recent");
        break;
      case "type":
        setFilterType("all");
        break;
      case "priority":
        setFilterPriority("all");
        break;
      case "status":
        setFilterStatus("all");
        break;
      default:
        break;
    }
  }, []);

  const visibleFeedbacks = useMemo(() => {
    const items = [...feedbacks];
    const getStatusOrder = (status: string) => {
      const normalized = status.trim().toLowerCase();
      if (normalized === "pending") return 0;
      if (normalized === "in progress") return 1;
      if (normalized === "resolved") return 2;
      return 3;
    };

    items.sort((a, b) => {
      const statusOrderDiff = getStatusOrder(a.status) - getStatusOrder(b.status);
      if (statusOrderDiff !== 0) {
        return statusOrderDiff;
      }

      const dateDiff =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (dateDiff !== 0) {
        return filterDate === "oldest" ? dateDiff : -dateDiff;
      }

      const nameA = (a.isAnonymous ? "*****" : a.userName || "*****").toLowerCase();
      const nameB = (b.isAnonymous ? "*****" : b.userName || "*****").toLowerCase();
      const nameComparison = filterName === "desc"
        ? nameB.localeCompare(nameA)
        : nameA.localeCompare(nameB);

      if (nameComparison !== 0) {
        return nameComparison;
      }

      return a.id.localeCompare(b.id);
    });

    return items;
  }, [feedbacks, filterDate, filterName]);

  const totalPages = Math.max(
    1,
    Math.ceil(visibleFeedbacks.length / FEEDBACKS_PER_PAGE),
  );

  const paginatedFeedbacks = useMemo(() => {
    const startIndex = (currentPage - 1) * FEEDBACKS_PER_PAGE;
    return visibleFeedbacks.slice(startIndex, startIndex + FEEDBACKS_PER_PAGE);
  }, [currentPage, visibleFeedbacks]);
  const adminPlaceholderRowCount = Math.max(
    0,
    FEEDBACKS_PER_PAGE - paginatedFeedbacks.length,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    currentAdmin?.unit,
    deferredSearchQuery,
    filterDate,
    filterName,
    filterPriority,
    filterStatus,
    filterType,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const formatSubmittedAt = (dateValue: string) => {
    const date = new Date(dateValue);
    const datePart = date.toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timePart = date
      .toLocaleTimeString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
      })
      .replace(" ", "")
      .toLowerCase();
    return `${datePart} ${timePart}`;
  };

  const getExportLogoDataUrl = useCallback(async () => {
    const image = new Image();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 256;
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to prepare export logo."));
          return;
        }

        context.imageSmoothingEnabled = true;
        context.clearRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      };

      image.onerror = () => {
        reject(new Error("Failed to load export logo."));
      };

      image.src = EXPORT_LOGO_PATH;
    });

    return dataUrl;
  }, []);

  const buildFileNameBase = () => {
    const now = new Date();
    const pad2 = (value: number) => String(value).padStart(2, "0");
    const dateStamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
      now.getDate(),
    )}`;
    const timeStamp = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
    const categoryStamp = (currentAdmin?.unit || "All")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "");
    const statusStamp =
      filterStatus === "all"
        ? "All"
        : filterStatus === "inprogress"
          ? "In-Progress"
          : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1);

    return `feedback-report_${categoryStamp}_${statusStamp}_${dateStamp}_${timeStamp}`;
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const getFilterSummary = () => {
    const filterParts = [
      filterType !== "all" ? `Type = ${filterType}` : null,
      filterStatus !== "all"
        ? `Status = ${filterStatus === "inprogress" ? "In Progress" : filterStatus}`
        : null,
      filterPriority !== "all" ? `Priority = ${filterPriority}` : null,
      filterDate === "recent" ? "Date = Most Recent" : "Date = Oldest",
      currentAdmin?.unit ? `Category = ${currentAdmin.unit}` : null,
      trimmedSearchQuery ? `Search = "${trimmedSearchQuery}"` : null,
    ].filter(Boolean);

    return filterParts.length ? filterParts.join(" | ") : "No filters applied";
  };

  const exportFeedbacksPdf = async () => {
    const rows = visibleFeedbacks.map((feedback) => ({
      id: feedback.id,
      type: feedback.type,
      status: feedback.status,
      priority: feedback.priority,
      submitted: formatSubmittedAt(feedback.createdAt),
      subject: formatFeedbackText(feedback.subject),
      message: formatFeedbackText(feedback.message),
    }));
    const filterSummary = getFilterSummary();
    const nowText = new Date().toLocaleString("en-US");
    const fileName = `${buildFileNameBase()}.pdf`;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    try {
      const logoDataUrl = await getExportLogoDataUrl();
      doc.addImage(logoDataUrl, "PNG", centerX - 40, 12, 80, 80);
    } catch {
      // Continue export without the image if logo loading fails.
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(31, 41, 55);
    doc.text("FeedForward - Feedback Report", centerX, 110, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated Date: ${nowText}`, centerX, 136, {
      align: "center",
    });
    doc.text(`Filter: ${filterSummary}`, centerX, 158, { align: "center" });
    doc.setDrawColor(255, 149, 0);
    doc.setLineWidth(1.5);
    doc.line(42, 180, pageWidth - 42, 180);

    if (!rows.length) {
      doc.setTextColor(120);
      doc.text("No feedback submissions match the current filters.", centerX, 228, {
        align: "center",
      });
      doc.save(fileName);
      return;
    }

    const body: RowInput[] = rows.flatMap((row): RowInput[] => [
      [
        { content: row.id, styles: { fontStyle: "bold", textColor: [31, 41, 55] } },
        { content: row.type },
        { content: row.status },
        { content: row.priority },
        { content: row.submitted },
        { content: row.subject },
      ],
      [
        {
          content: `Message: ${row.message || "-"}`,
          colSpan: 6,
          styles: {
            fontStyle: "normal",
            textColor: [107, 114, 128],
            fillColor: [255, 255, 255],
            cellPadding: { top: 10, right: 12, bottom: 10, left: 12 },
          },
        },
      ],
      [
        {
          content: "",
          colSpan: 6,
          styles: {
            cellPadding: 0,
            minCellHeight: 16,
            lineWidth: 0,
            fillColor: [255, 255, 255],
          },
        },
      ],
    ]);
    const tableWidth = 132 + 78 + 100 + 84 + 136 + 248;
    const tableMargin = Math.max(30, (pageWidth - tableWidth) / 2);

    autoTable(doc, {
      startY: 198,
      head: [[
        "TRACKING ID",
        "TYPE",
        "STATUS",
        "PRIORITY",
        "SUBMITTED ON",
        "SUBJECT",
      ]],
      body,
      theme: "grid",
      margin: { left: tableMargin, right: tableMargin },
      styles: {
        fontSize: 10,
        cellPadding: { top: 12, right: 12, bottom: 12, left: 12 },
        valign: "top",
        lineColor: [223, 228, 235],
        lineWidth: 0.6,
        textColor: [31, 41, 55],
        fillColor: [244, 247, 251],
      },
      headStyles: {
        fillColor: [24, 30, 45],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
        cellPadding: { top: 13, right: 12, bottom: 13, left: 12 },
        lineColor: [24, 30, 45],
        lineWidth: 0,
      },
      columnStyles: {
        0: { cellWidth: 132 },
        1: { cellWidth: 78 },
        2: { cellWidth: 100 },
        3: { cellWidth: 84 },
        4: { cellWidth: 136 },
        5: { cellWidth: 248 },
      },
      didParseCell: (hookData) => {
        if (hookData.section !== "body") return;
        const rowType = hookData.row.index % 3;

        if (rowType === 1) {
          hookData.cell.styles.fillColor = [255, 255, 255];
          hookData.cell.styles.lineWidth = 0.6;
          hookData.cell.styles.lineColor = [223, 228, 235];
        }

        if (rowType === 2) {
          hookData.cell.styles.fillColor = [255, 255, 255];
          hookData.cell.styles.lineWidth = 0;
        }
      },
    });

    doc.save(fileName);
  };

  const exportFeedbacksXlsx = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Feedback Report", {
      views: [{ showGridLines: false }],
    });
    const filterSummary = getFilterSummary();
    const nowText = new Date().toLocaleString("en-US");
    const fileName = `${buildFileNameBase()}.xlsx`;

    worksheet.columns = [
      { key: "a", width: 6 },
      { key: "b", width: 18 },
      { key: "c", width: 14 },
      { key: "d", width: 18 },
      { key: "e", width: 14 },
      { key: "f", width: 28 },
      { key: "g", width: 46 },
      { key: "h", width: 6 },
    ];

    worksheet.mergeCells("B1:G1");
    worksheet.getCell("B1").value = "";
    worksheet.getCell("B1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getRow(1).height = 64;

    try {
      const logoDataUrl = await getExportLogoDataUrl();
      const logoImageId = workbook.addImage({
        base64: logoDataUrl,
        extension: "png",
      });
      const logoWidth = 84;
      const logoHeight = 84;

      worksheet.addImage(logoImageId, {
        tl: { col: 5, row: 0.08 },
        ext: { width: logoWidth, height: logoHeight },
      });
    } catch {
      // Continue export without the image if logo loading fails.
    }

    worksheet.mergeCells("B3:G3");
    worksheet.getCell("B3").value = "FeedForward - Feedback Report";
    worksheet.getCell("B3").font = {
      name: "Arial",
      size: 24,
      bold: true,
      color: { argb: "FF1F2937" },
    };
    worksheet.getCell("B3").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getRow(3).height = 34;

    worksheet.mergeCells("B4:G4");
    worksheet.getCell("B4").value = `Generated Date: ${nowText}`;
    worksheet.getCell("B4").font = {
      name: "Arial",
      size: 14,
      color: { argb: "FF6B7280" },
    };
    worksheet.getCell("B4").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.mergeCells("B5:G5");
    worksheet.getCell("B5").value = `Filter: ${filterSummary}`;
    worksheet.getCell("B5").font = {
      name: "Arial",
      size: 14,
      color: { argb: "FF6B7280" },
    };
    worksheet.getCell("B5").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.mergeCells("A7:H7");
    worksheet.getCell("A7").border = {
      bottom: {
        style: "thin",
        color: { argb: "FFFF9500" },
      },
    };

    const headerRowIndex = 9;
    const headerCells = ["B", "C", "D", "E", "F", "G"];
    const headers = [
      "TRACKING ID",
      "TYPE",
      "STATUS",
      "PRIORITY",
      "SUBMITTED ON",
      "SUBJECT",
    ];

    headers.forEach((header, index) => {
      const cell = worksheet.getCell(`${headerCells[index]}${headerRowIndex}`);
      cell.value = header;
      cell.font = {
        name: "Arial",
        size: 12,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF181E2D" },
      };
    });
    worksheet.getRow(headerRowIndex).height = 28;

    let currentRow = headerRowIndex + 1;
    const borderColor = { argb: "FFDDE4EB" };

    if (visibleFeedbacks.length === 0) {
      worksheet.mergeCells(`B${currentRow}:G${currentRow}`);
      const emptyCell = worksheet.getCell(`B${currentRow}`);
      emptyCell.value = "No feedback submissions match the current filters.";
      emptyCell.font = {
        name: "Arial",
        size: 12,
        color: { argb: "FF6B7280" },
      };
      emptyCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      currentRow += 2;
    } else {
      visibleFeedbacks.forEach((feedback) => {
        const rowValues = [
          feedback.id,
          feedback.type,
          feedback.status,
          feedback.priority,
          formatSubmittedAt(feedback.createdAt),
          feedback.subject,
        ];

        rowValues.forEach((value, index) => {
          const cell = worksheet.getCell(`${headerCells[index]}${currentRow}`);
          cell.value = value;
          cell.font = {
            name: "Arial",
            size: 11,
            bold: index === 0,
            color: { argb: "FF1F2937" },
          };
          cell.alignment = {
            horizontal: "left",
            vertical: "middle",
            wrapText: true,
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF4F7FB" },
          };
          cell.border = {
            top: { style: "thin", color: borderColor },
            left: { style: "thin", color: borderColor },
            bottom: { style: "thin", color: borderColor },
            right: { style: "thin", color: borderColor },
          };
        });
        worksheet.getRow(currentRow).height = 28;
        currentRow += 1;

        worksheet.mergeCells(`B${currentRow}:G${currentRow}`);
        const messageCell = worksheet.getCell(`B${currentRow}`);
        messageCell.value = `Message: ${feedback.message || "-"}`;
        messageCell.font = {
          name: "Arial",
          size: 11,
          color: { argb: "FF6B7280" },
        };
        messageCell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
        messageCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" },
        };
        messageCell.border = {
          top: { style: "thin", color: borderColor },
          left: { style: "thin", color: borderColor },
          bottom: { style: "thin", color: borderColor },
          right: { style: "thin", color: borderColor },
        };
        worksheet.getRow(currentRow).height = 26;
        currentRow += 2;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      fileName,
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <AlertDialog
        open={isUnsentMessageDialogOpen}
        onOpenChange={setIsUnsentMessageDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsent message?</AlertDialogTitle>
            <AlertDialogDescription>
              You have a message that has not been sent yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsUnsentMessageDialogOpen(false);
                closeEditDialog();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="px-4 pb-6 pt-4 sm:px-7 sm:pt-6">
        <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 rounded-[28px] border border-[#e7dfd3] bg-white px-5 py-6 shadow-[0_24px_80px_rgba(34,25,12,0.08)] sm:px-8 sm:py-8">
          <div
            className={`flex flex-col gap-4 transition-[padding] duration-300 ease-out lg:flex-row lg:items-center lg:justify-between ${
              isSplitPaneOpen
                ? "xl:pr-[calc(40%+1rem)]"
                : "xl:pr-0"
            }`}
          >
            <div className="flex h-9 items-center gap-3">
              <div className="flex h-9 w-11 items-center justify-center rounded-2xl bg-muted/50 text-[#171717]">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="flex h-9 items-center">
                <h2 className="text-[21px] font-semibold leading-none tracking-[-0.02em] text-[#171717]">
                  Submission History
                </h2>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 rounded-[12px] border-[#eceae5] bg-white px-5 text-[14px] font-semibold text-[#171717] shadow-none hover:bg-[#f7f3ee]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void exportFeedbacksXlsx()}>
                  Export XLSX
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportFeedbacksPdf()}>
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div
            className={`grid gap-x-3 gap-y-2 transition-[padding] duration-300 ease-out xl:grid-cols-[minmax(0,1.9fr)_repeat(5,minmax(0,1fr))] ${
              isSplitPaneOpen
                ? "xl:pr-[calc(40%+1rem)]"
                : "xl:pr-0"
            }`}
          >
            <div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: ADMIN_FILTER_MUTED_COLOR }}
                />
                <Input
                  placeholder="Search by ID, subject, or name."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className={`${ADMIN_FILTER_CONTROL_CLASS} placeholder:text-[#8f877d]`}
                  style={{
                    color: ADMIN_FILTER_TEXT_COLOR,
                    paddingLeft: "2.75rem",
                  }}
                />
              </div>
            </div>

            {inlineFilterChips.map((filter) => (
              <div key={filter.key} className="space-y-1.5">
                <Select value={filter.value} onValueChange={filter.onChange}>
                  <SelectTrigger
                    className={`${ADMIN_FILTER_CONTROL_CLASS} [&_svg]:text-[#6f6255]`}
                    style={{ color: ADMIN_FILTER_TEXT_COLOR }}
                  >
                    <SelectValue placeholder={filter.chipLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options.map((option) => (
                      <SelectItem key={`${filter.key}-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {activeFilterPills.length > 0 ? (
            <div
              className={`flex flex-wrap items-center gap-2 transition-[padding] duration-300 ease-out ${
                isSplitPaneOpen
                  ? "xl:pr-[calc(40%+1rem)]"
                  : "xl:pr-0"
              }`}
            >
              {activeFilterPills.map((pill) => (
                <span
                  key={pill.key}
                  className={`${ADMIN_FILTER_CHIP_CLASS} gap-1.5`}
                >
                  {pill.label}
                  <button
                    type="button"
                    onClick={() => clearSingleFilter(pill.key)}
                    className="inline-flex items-center justify-center rounded-full p-0.5 text-[#6f6255] transition-colors hover:bg-[#efe5da] hover:text-[#4d463e]"
                    aria-label={`Remove ${pill.label} filter`}
                    title={`Remove ${pill.label} filter`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors hover:bg-[#f7f3ee] hover:text-[#4d463e]"
                  style={{ color: ADMIN_FILTER_TEXT_COLOR }}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear all
                </button>
              ) : null}
            </div>
          ) : null}

          {visibleFeedbacks.length === 0 && !isFeedbacksLoading ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#e6ddd1] bg-[#fcfaf7] px-6 text-center">
              <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold text-[#171717]">
                No Feedback Found
              </h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters for this unit.
              </p>
            </div>
          ) : (
            <div
              className={
                isSplitPaneLayout
                  ? "flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start"
                  : "space-y-2"
              }
            >
              <div className="min-w-0 flex-1 space-y-2">
              <div className="relative w-full overflow-x-auto">
                <Table className="w-full min-w-[980px] text-xs sm:text-sm [&_td]:px-3 [&_th]:px-3">
                  <TableHeader className="sticky top-0 z-10 bg-muted/50">
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Tracking ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-[260px] px-2">Category</TableHead>
                      <TableHead className="w-[100px] px-2">Priority</TableHead>
                      <TableHead className="w-[120px] px-2">Status</TableHead>
                      <TableHead className="w-[118px] whitespace-nowrap px-2">
                        Date
                      </TableHead>
                      <TableHead className="w-[88px] text-center">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {paginatedFeedbacks.map((feedback) => (
                    <TableRow
                      key={feedback.id}
                      className={`h-14 ${
                        selectedFeedback?.id === feedback.id
                          ? "bg-[#fff8ee] shadow-[inset_3px_0_0_0_#f0a500]"
                          : ""
                      }`}
                    >
                      <TableCell
                        className="truncate text-sm font-medium"
                        title={
                          feedback.isAnonymous
                            ? "*****"
                            : feedback.userName || "*****"
                        }
                      >
                        {feedback.isAnonymous
                          ? "*****"
                          : feedback.userName
                            ? feedback.userName.split(" ")[0]
                            : "*****"}
                      </TableCell>
                      <TableCell
                        className="truncate font-mono text-xs text-muted-foreground"
                        title={feedback.id}
                      >
                        {feedback.id}
                      </TableCell>
                      <TableCell className="truncate">
                        <Badge variant="outline" className="capitalize">
                          {feedback.type}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="w-[260px] max-w-[260px] truncate px-2"
                        title={feedback.category}
                      >
                        {feedback.category}
                      </TableCell>
                      <TableCell className="w-[100px] truncate px-2">
                        <Badge
                          className={getPriorityColor(feedback.priority)}
                          variant="outline"
                        >
                          {feedback.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="truncate px-2">
                        <Badge
                          className={getStatusColor(feedback.status)}
                          variant="outline"
                        >
                          {feedback.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2 text-muted-foreground">
                        {formatSubmittedAt(feedback.createdAt)}
                      </TableCell>
                      <TableCell className="w-[88px] text-center">
                        <div className="flex justify-center">
                          {isSplitPaneLayout ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md"
                              aria-label={`Open ${feedback.id}`}
                              title="Open feedback"
                              onClick={(event) => {
                                event.stopPropagation();
                                void openFeedbackDialog(feedback);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Dialog
                              open={
                                isEditDialogOpen &&
                                selectedFeedback?.id === feedback.id
                              }
                              onOpenChange={(open) => {
                                if (!open) {
                                  handleAttemptCloseEditDialog();
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md"
                                aria-label={`Edit ${feedback.id}`}
                                title="Edit feedback"
                                onClick={() => void openFeedbackDialog(feedback)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              </DialogTrigger>
                              <DialogContent
                                className={
                                  activeEditTab === "manage"
                                    ? "flex h-[85vh] max-h-[85vh] max-w-2xl flex-col overflow-hidden"
                                    : "flex max-h-[80vh] max-w-2xl flex-col overflow-hidden"
                                }
                                onInteractOutside={(event) => event.preventDefault()}
                                onEscapeKeyDown={(event) => event.preventDefault()}
                              >
                              <DialogHeader>
                                <DialogTitle>Feedback Details</DialogTitle>
                                <DialogDescription>
                                  Tracking ID: {selectedFeedback?.id}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedFeedback ? (
                                <Tabs
                                  value={activeEditTab}
                                  onValueChange={(value) =>
                                    setActiveEditTab(value as "details" | "manage")
                                  }
                                  className="flex min-h-0 w-full flex-1 flex-col"
                                >
                                  <TabsList className="grid w-full shrink-0 grid-cols-2 rounded-full">
                                    <TabsTrigger value="details">
                                      Details
                                    </TabsTrigger>
                                    <TabsTrigger value="manage">Manage</TabsTrigger>
                                  </TabsList>

                                  <TabsContent
                                    value="details"
                                    className="ff-hide-scrollbar flex min-h-0 flex-1 flex-col space-y-4 overflow-x-hidden overflow-y-auto pr-1"
                                  >
                                    <FeedbackDetailsCard
                                      feedback={selectedFeedback}
                                      title=""
                                      className="rounded-none border-0 bg-transparent shadow-none"
                                      formatDate={formatDetailsUpdatedAt}
                                      preSubjectContent={
                                        <div className="grid grid-cols-1 gap-y-8">
                                          <div className="space-y-1">
                                            <Label className="text-muted-foreground">
                                              Submitted By
                                            </Label>
                                            <p className="pt-0.5 text-[0.98rem] font-medium">
                                              {selectedFeedback.isAnonymous
                                                ? "*****"
                                                : selectedFeedback.userName || "*****"}
                                            </p>
                                          </div>
                                        </div>
                                      }
                                    />

                                    {selectedFeedback.response ? (
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Current Response
                                        </Label>
                                        <div className="mt-2 max-h-[260px] overflow-y-auto rounded-lg border border-accent/20 bg-accent/5 p-4">
                                          <div className="space-y-3">
                                            {parseAdminResponses(
                                              selectedFeedback.response,
                                            ).map((entry, index) => (
                                              <div
                                                key={`${entry.time ?? "note"}-${index}`}
                                              >
                                                <p className="text-[10px] font-semibold text-muted-foreground">
                                                  {entry.author || "Admin"}{" "}
                                                  {entry.time
                                                    ? formatLocalTime(entry.time)
                                                    : ""}
                                                </p>
                                                <p className="text-sm leading-relaxed text-foreground/90">
                                                  {entry.message}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                  </TabsContent>

                                  <TabsContent
                                    value="manage"
                                    className="flex min-h-0 flex-1 flex-col space-y-4"
                                  >
                                  <div className="space-y-2">
                                    <Label htmlFor="status">Update Status</Label>
                                    <Select
                                      value={newStatus}
                                      onValueChange={setNewStatus}
                                    >
                                      <SelectTrigger id="status">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Pending">
                                          Pending
                                        </SelectItem>
                                        <SelectItem value="In Progress">
                                          In Progress
                                        </SelectItem>
                                        <SelectItem value="Resolved">
                                          Resolved
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="priority">
                                      Update Priority
                                    </Label>
                                    <Select
                                      value={newPriority}
                                      onValueChange={setNewPriority}
                                    >
                                      <SelectTrigger id="priority">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Low">Low</SelectItem>
                                        <SelectItem value="Medium">
                                          Medium
                                        </SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="flex min-h-0 flex-1 flex-col space-y-3">
                                    <div className="flex items-center gap-2">
                                      <MessageSquare className="h-5 w-5 text-foreground" />
                                      <p className="text-base font-semibold">
                                        Message
                                      </p>
                                    </div>

                                    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-white/70">
                                      <div className="flex h-full min-h-0 flex-col">
                                        <div
                                          ref={messageScrollRef}
                                          className="ff-hide-scrollbar min-h-0 flex-1 overflow-y-auto p-4"
                                        >
                                          {isMessagesLoading ? (
                                            <p className="text-sm text-muted-foreground">
                                              Loading conversation...
                                            </p>
                                          ) : null}
                                          {!isMessagesLoading &&
                                          messages.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                              No messages yet.
                                            </p>
                                          ) : null}
                                          <div className="space-y-4">
                                            {(() => {
                                              let lastDayLabel = "";
                                              return messages.map((entry, index, allMessages) => {
                                                const createdAt = entry.createdAt
                                                  ? new Date(entry.createdAt)
                                                  : null;
                                                const today = new Date();
                                                const yesterday = new Date();
                                                yesterday.setDate(today.getDate() - 1);

                                                const dayLabel = createdAt
                                                  ? createdAt.toDateString() === today.toDateString()
                                                    ? "Today"
                                                    : createdAt.toDateString() === yesterday.toDateString()
                                                      ? "Yesterday"
                                                      : createdAt.toLocaleDateString(undefined, {
                                                          month: "short",
                                                          day: "numeric",
                                                          year: "numeric",
                                                        })
                                                  : "";
                                                const showDayLabel =
                                                  dayLabel && dayLabel !== lastDayLabel;
                                                if (showDayLabel) {
                                                  lastDayLabel = dayLabel;
                                                }

                                                const isUserMessage = entry.senderRole === "user";
                                                const name = isUserMessage
                                                  ? selectedFeedback?.isAnonymous
                                                    ? "Anonymous"
                                                    : entry.senderName || "User"
                                                  : "You";
                                                const prev = index > 0 ? allMessages[index - 1] : null;
                                                const prevIsUser = prev ? prev.senderRole === "user" : false;
                                                const prevName = prev
                                                  ? prevIsUser
                                                    ? selectedFeedback?.isAnonymous
                                                      ? "Anonymous"
                                                      : prev.senderName || "User"
                                                    : "You"
                                                  : "";
                                                const showName =
                                                  !prev ||
                                                  showDayLabel ||
                                                  prev.senderRole !== entry.senderRole ||
                                                  prevName !== name;
                                                const hasVeryLongToken = /\S{24,}/.test(
                                                  entry.message || "",
                                                );
                                                const isLikelyMultiLine =
                                                  (entry.message || "").includes("\n") ||
                                                  (entry.message || "").length > 60;

                                                return (
                                                  <div key={entry.id} className="space-y-2">
                                                    {showDayLabel ? (
                                                      <div className="flex justify-center">
                                                        <span className="rounded-full border border-border bg-white/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                                                          {dayLabel}
                                                        </span>
                                                      </div>
                                                    ) : null}
                                                    <div
                                                      className={`flex ${isUserMessage ? "justify-start" : "justify-end"}`}
                                                    >
                                                      <div
                                                        className={`group relative w-fit min-w-0 max-w-[78%] sm:max-w-md ${isUserMessage ? "text-left" : "text-right"}`}
                                                      >
                                                        {showName ? (
                                                          <p className="mb-1 px-1 text-sm font-semibold text-muted-foreground">
                                                            {name}
                                                          </p>
                                                        ) : null}
                                                        <div
                                                          className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                                            isUserMessage
                                                              ? "border border-border bg-white text-foreground"
                                                              : "bg-accent text-white"
                                                          }`}
                                                        >
                                                          <p
                                                            className={`whitespace-pre-line leading-relaxed ${
                                                              hasVeryLongToken
                                                                ? "break-all"
                                                                : "break-words"
                                                            }`}
                                                          >
                                                            {isUserMessage
                                                              ? formatFeedbackText(
                                                                  entry.message || "",
                                                                )
                                                              : entry.message}
                                                          </p>
                                                        </div>
                                                        {entry.createdAt ? (
                                                          <span
                                                            className={`pointer-events-none absolute z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-2xl bg-black/50 px-3 py-1.5 text-xs text-white shadow-sm group-hover:inline-flex ${
                                                              isUserMessage
                                                                ? "-right-1 translate-x-full"
                                                                : "-left-1 -translate-x-full"
                                                            } ${
                                                              isLikelyMultiLine
                                                                ? "top-1/2"
                                                                : "top-[68%]"
                                                            }`}
                                                          >
                                                            {formatLocalTime(entry.createdAt)}
                                                          </span>
                                                        ) : null}
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              });
                                            })()}
                                          </div>
                                        </div>

                                      <ReplyComposer
                                        key={selectedFeedback.id}
                                        draft={messageDraft}
                                        onDraftChange={setMessageDraft}
                                        isSendingMessage={isSendingMessage}
                                        onSend={handleSendMessage}
                                      />
                                    </div>
                                  </div>
                                </div>

                                  <div className="-mt-px shrink-0 rounded-b-lg border-x border-b border-border bg-muted/30 px-3 pb-3 pt-6">
                                    <Button
                                      onClick={handleUpdateFeedback}
                                      className="mx-auto block w-3/5 bg-accent hover:bg-accent/90"
                                      disabled={!hasFeedbackChanges}
                                    >
                                      Update Feedback
                                    </Button>
                                    <p className="pt-2 text-center text-xs text-muted-foreground">
                                      Marking a submission as Resolved will email
                                      the user if they registered an account.
                                    </p>
                                  </div>
                                </TabsContent>
                              </Tabs>
                            ) : null}
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedFeedbacks.length > 0 && adminPlaceholderRowCount > 0
                    ? Array.from({ length: adminPlaceholderRowCount }).map(
                        (_, index) => (
                          <TableRow
                            key={`admin-placeholder-row-${index}`}
                            className="h-14"
                            aria-hidden="true"
                          >
                            <TableCell colSpan={8} />
                          </TableRow>
                        ),
                      )
                    : null}
                  </TableBody>
                </Table>
                {isFeedbacksLoading ? (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
                    <div className="rounded-full border border-[#e6ddd1] bg-white/90 px-3 py-1 text-xs font-medium text-muted-foreground animate-pulse">
                      Loading feedback submissions...
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              </div>
              {isSplitPaneLayout ? (
                <div
                  className={`xl:translate-y-[var(--split-pane-shift)] xl:mb-[var(--split-pane-space-comp)] transition-[width,opacity,transform,border-color,box-shadow,height,max-height,min-height,margin-bottom] duration-300 ease-out ${
                    isSplitPaneOpen
                      ? "w-full opacity-100 translate-x-0 xl:w-[40%] xl:min-w-[360px]"
                      : "w-0 translate-x-4 opacity-0 pointer-events-none"
                  } overflow-hidden rounded-[20px] border bg-white ${
                    isSplitPaneOpen
                      ? "border-[#e6ddd1] shadow-[0_12px_32px_rgba(34,25,12,0.08)]"
                      : "border-transparent shadow-none"
                  } relative ${
                    isSplitPaneOpen
                      ? "xl:self-start xl:h-[78vh] xl:min-h-[640px] xl:max-h-[900px]"
                      : "xl:h-0 xl:min-h-0 xl:max-h-0"
                  }`}
                  style={
                    {
                      "--split-pane-shift": isSplitPaneOpen
                        ? splitPaneTopShift
                        : "0px",
                      "--split-pane-space-comp": isSplitPaneOpen
                        ? splitPaneTopShift
                        : "0px",
                    } as CSSProperties
                  }
                >
                  {selectedFeedback ? (
                    <div
                      ref={splitDetailContentRef}
                      className="relative z-[2] flex h-full min-h-[560px] flex-col"
                    >
                    <Tabs
                      value={activeEditTab}
                      onValueChange={(value) =>
                        setActiveEditTab(value as "details" | "manage")
                      }
                      className="flex h-full min-h-[560px] flex-col"
                    >
                      <div className="shrink-0 border-b border-[#efe7dc] px-5 pb-4 pt-5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-[#171717]">
                              Feedback Details
                            </h3>
                            <p className="font-mono text-xs text-muted-foreground">
                              Tracking ID: {selectedFeedback.id}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-md"
                            onClick={handleAttemptCloseEditDialog}
                            aria-label="Close details panel"
                            title="Close details panel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <TabsList className="grid w-full shrink-0 grid-cols-2 rounded-full">
                          <TabsTrigger value="details">Details</TabsTrigger>
                          <TabsTrigger value="manage">Manage</TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent
                        value="details"
                        className="ff-hide-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pb-5 pt-4"
                      >
                        <div className="space-y-6">
                          <FeedbackDetailsCard
                            feedback={selectedFeedback}
                            title=""
                            className="rounded-none border-0 bg-transparent shadow-none"
                            formatDate={formatDetailsUpdatedAt}
                            preSubjectContent={
                              <div className="grid grid-cols-1 gap-y-8">
                                <div className="space-y-1">
                                  <Label className="text-muted-foreground">
                                    Submitted By
                                  </Label>
                                  <p className="pt-0.5 text-[0.98rem] font-medium">
                                    {selectedFeedback.isAnonymous
                                      ? "*****"
                                      : selectedFeedback.userName || "*****"}
                                  </p>
                                </div>
                              </div>
                            }
                          />

                          {selectedFeedback.response ? (
                            <div>
                              <Label className="text-muted-foreground">
                                Current Response
                              </Label>
                              <div className="mt-2 max-h-[260px] overflow-y-auto rounded-lg border border-accent/20 bg-accent/5 p-4">
                                <div className="space-y-3">
                                  {parseAdminResponses(
                                    selectedFeedback.response,
                                  ).map((entry, index) => (
                                    <div
                                      key={`${entry.time ?? "note"}-${index}`}
                                    >
                                      <p className="text-[10px] font-semibold text-muted-foreground">
                                        {entry.author || "Admin"}{" "}
                                        {entry.time
                                          ? formatLocalTime(entry.time)
                                          : ""}
                                      </p>
                                      <p className="text-sm leading-relaxed text-foreground/90">
                                        {entry.message}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </TabsContent>

                      <TabsContent
                        value="manage"
                        className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5 pt-4"
                      >
                        <div className="shrink-0 border-b border-border/70 pb-4">
                          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <div className="space-y-2">
                              <Label htmlFor="split-status">Status</Label>
                              <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger id="split-status">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Pending">Pending</SelectItem>
                                  <SelectItem value="In Progress">In Progress</SelectItem>
                                  <SelectItem value="Resolved">Resolved</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="split-priority">Priority</Label>
                              <Select
                                value={newPriority}
                                onValueChange={setNewPriority}
                              >
                                <SelectTrigger id="split-priority">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Low">Low</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="High">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <Button
                              type="button"
                              onClick={handleUpdateFeedback}
                              className="h-10 px-6 bg-accent hover:bg-accent/90"
                              disabled={!hasFeedbackChanges}
                            >
                              Save
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                          <div className="mb-3 flex shrink-0 items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-foreground" />
                            <p className="text-base font-semibold">Message thread</p>
                          </div>

                          <div
                            ref={messageScrollRef}
                            className="ff-hide-scrollbar min-h-0 flex-1 overflow-y-auto pr-1"
                          >
                            {isMessagesLoading ? (
                              <p className="text-sm text-muted-foreground">
                                Loading conversation...
                              </p>
                            ) : null}
                            {!isMessagesLoading && messages.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No messages yet.
                              </p>
                            ) : null}
                            <div className="space-y-4">
                              {(() => {
                                let lastDayLabel = "";
                                return messages.map((entry, index, allMessages) => {
                                  const createdAt = entry.createdAt
                                    ? new Date(entry.createdAt)
                                    : null;
                                  const today = new Date();
                                  const yesterday = new Date();
                                  yesterday.setDate(today.getDate() - 1);

                                  const dayLabel = createdAt
                                    ? createdAt.toDateString() === today.toDateString()
                                      ? "Today"
                                      : createdAt.toDateString() === yesterday.toDateString()
                                        ? "Yesterday"
                                        : createdAt.toLocaleDateString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          })
                                    : "";
                                  const showDayLabel = dayLabel && dayLabel !== lastDayLabel;
                                  if (showDayLabel) {
                                    lastDayLabel = dayLabel;
                                  }

                                  const isUserMessage = entry.senderRole === "user";
                                  const name = isUserMessage
                                    ? selectedFeedback?.isAnonymous
                                      ? "Anonymous"
                                      : entry.senderName || "User"
                                    : "You";
                                  const prev = index > 0 ? allMessages[index - 1] : null;
                                  const prevIsUser = prev ? prev.senderRole === "user" : false;
                                  const prevName = prev
                                    ? prevIsUser
                                      ? selectedFeedback?.isAnonymous
                                        ? "Anonymous"
                                        : prev.senderName || "User"
                                      : "You"
                                    : "";
                                  const showName =
                                    !prev ||
                                    showDayLabel ||
                                    prev.senderRole !== entry.senderRole ||
                                    prevName !== name;
                                  const hasVeryLongToken = /\S{24,}/.test(
                                    entry.message || "",
                                  );
                                  const isLikelyMultiLine =
                                    (entry.message || "").includes("\n") ||
                                    (entry.message || "").length > 60;

                                  return (
                                    <div key={entry.id} className="space-y-2">
                                      {showDayLabel ? (
                                        <div className="flex justify-center">
                                          <span className="rounded-full border border-border bg-white/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                                            {dayLabel}
                                          </span>
                                        </div>
                                      ) : null}
                                      <div
                                        className={`flex ${isUserMessage ? "justify-start" : "justify-end"}`}
                                      >
                                        <div
                                          className={`group relative w-fit min-w-0 max-w-[78%] sm:max-w-md ${isUserMessage ? "text-left" : "text-right"}`}
                                        >
                                          {showName ? (
                                            <p className="mb-1 px-1 text-sm font-semibold text-muted-foreground">
                                              {name}
                                            </p>
                                          ) : null}
                                          <div
                                            className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                              isUserMessage
                                                ? "border border-border bg-white text-foreground"
                                                : "bg-accent text-white"
                                            }`}
                                          >
                                            <p
                                              className={`whitespace-pre-line leading-relaxed ${
                                                hasVeryLongToken
                                                  ? "break-all"
                                                  : "break-words"
                                              }`}
                                            >
                                              {isUserMessage
                                                ? formatFeedbackText(
                                                    entry.message || "",
                                                  )
                                                : entry.message}
                                            </p>
                                          </div>
                                          {entry.createdAt ? (
                                            <span
                                              className={`pointer-events-none absolute z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-2xl bg-black/50 px-3 py-1.5 text-xs text-white shadow-sm group-hover:inline-flex ${
                                                isUserMessage
                                                  ? "-right-1 translate-x-full"
                                                  : "-left-1 -translate-x-full"
                                              } ${
                                                isLikelyMultiLine
                                                  ? "top-1/2"
                                                  : "top-[68%]"
                                              }`}
                                            >
                                              {formatLocalTime(entry.createdAt)}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 shrink-0 border-t border-border/70 px-1 pt-3">
                          <ReplyComposer
                            key={selectedFeedback.id}
                            draft={messageDraft}
                            onDraftChange={setMessageDraft}
                            isSendingMessage={isSendingMessage}
                            onSend={handleSendMessage}
                          />
                          <p className="pt-1 text-center text-xs text-muted-foreground">
                            Marking a submission as Resolved will email
                            the user if they registered an account.
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            )}
          </div>
        </div>
      </div>
  );
}