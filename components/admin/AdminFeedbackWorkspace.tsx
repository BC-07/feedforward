"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { parseAdminResponses } from "@/lib/responseLog";
import { formatLocalTime } from "@/lib/time";
import { toastApiError } from "@/lib/errorHandling";
import { formatFilterChipLabel } from "@/lib/filterUtils";
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

const FEEDBACKS_PER_PAGE = 8;
const EXPORT_LOGO_PATH = "/favicon.ico";
const DETAILS_MESSAGE_PREVIEW_MAX_CHARS = 220;

function ActiveFilterChip({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="rounded-full border-border bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground"
    >
      {label}
    </Badge>
  );
}

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
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterName, setFilterName] = useState("asc");
  const [filterDate, setFilterDate] = useState("recent");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsMessageExpanded, setIsDetailsMessageExpanded] =
    useState(false);
  const [activeEditTab, setActiveEditTab] = useState<"details" | "manage">(
    "details",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const openedFeedbackRequestRef = useRef("");
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const trimmedSearchQuery = searchQuery.trim();
  const requestedFeedbackId = searchParams.get("feedbackId")?.trim() || "";
  const requestedFeedbackOpenToken = searchParams.get("open")?.trim() || "";
  const hasFeedbackChanges = selectedFeedback
    ? newStatus !== selectedFeedback.status ||
      newPriority !== selectedFeedback.priority
    : false;
  const selectedFeedbackMessage = selectedFeedback?.message ?? "";
  const canExpandSelectedMessage =
    selectedFeedbackMessage.trim().length > DETAILS_MESSAGE_PREVIEW_MAX_CHARS;
  const displayedSelectedMessage = useMemo(() => {
    if (isDetailsMessageExpanded || !canExpandSelectedMessage) {
      return selectedFeedbackMessage;
    }

    return `${selectedFeedbackMessage.slice(0, DETAILS_MESSAGE_PREVIEW_MAX_CHARS)}...`;
  }, [
    canExpandSelectedMessage,
    isDetailsMessageExpanded,
    selectedFeedbackMessage,
  ]);

  useEffect(() => {
    setIsDetailsMessageExpanded(false);
  }, [selectedFeedback?.id]);

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

  const openFeedbackDialog = useCallback(
    async (feedback: Feedback) => {
      setSelectedFeedback(feedback);
      setNewStatus(feedback.status);
      setNewPriority(feedback.priority);
      setActiveEditTab("details");
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

  const handleSendMessage = useCallback(async () => {
    if (!selectedFeedback) return;
    if (isSendingMessage) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) {
      toast.error("Please enter a message.");
      return;
    }

    setIsSendingMessage(true);
    try {
      const created = await createFeedbackMessage(selectedFeedback.id, {
        message: trimmed,
      });
      setMessages((prev) => [...prev, created]);
      setMessageDraft("");
      scrollMessagesToBottom("smooth");
      window.requestAnimationFrame(() => {
        replyInputRef.current?.focus();
      });
    } catch (error) {
      toastApiError(error, "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  }, [isSendingMessage, messageDraft, scrollMessagesToBottom, selectedFeedback]);

  useEffect(() => {
    if (!isEditDialogOpen || activeEditTab !== "manage") return;
    if (isMessagesLoading) return;
    scrollMessagesToBottom();
  }, [
    activeEditTab,
    isEditDialogOpen,
    isMessagesLoading,
    messages.length,
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
      setMessageDraft("");
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

  const nameFilterLabel = filterName === "desc" ? "Z - A" : null;
  const dateFilterLabel = filterDate === "oldest" ? "Oldest" : null;
  const typeFilterLabel =
    filterType !== "all" ? formatFilterChipLabel(filterType) : null;
  const priorityFilterLabel =
    filterPriority !== "all" ? formatFilterChipLabel(filterPriority) : null;
  const statusFilterLabel =
    filterStatus !== "all"
      ? filterStatus === "inprogress"
        ? "In Progress"
        : formatFilterChipLabel(filterStatus)
      : null;
  const hasActiveFilters = Boolean(
    trimmedSearchQuery ||
      nameFilterLabel ||
      dateFilterLabel ||
      typeFilterLabel ||
      priorityFilterLabel ||
      statusFilterLabel,
  );

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setFilterName("asc");
    setFilterDate("recent");
    setFilterType("all");
    setFilterPriority("all");
    setFilterStatus("all");
  }, []);

  const visibleFeedbacks = useMemo(() => {
    const items = [...feedbacks];
    items.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      const dateComparison =
        filterDate === "oldest" ? timeA - timeB : timeB - timeA;

      if (dateComparison !== 0) {
        return dateComparison;
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
      searchQuery ? `Search = "${searchQuery}"` : null,
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
      subject: feedback.subject,
      message: feedback.message,
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
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Submission History
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="sm:self-start">
                  <Download className="h-4 w-4" />
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
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-7">
            <div
              className={`sm:col-span-2 xl:col-span-2 ${hasActiveFilters ? "space-y-2" : ""}`}
            >
              <Input
                placeholder="Search by ID, subject, or message..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {hasActiveFilters ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-7 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear all
                  </Button>
                </div>
              ) : null}
            </div>

            <div className={nameFilterLabel ? "space-y-2" : undefined}>
              <Select value={filterName} onValueChange={setFilterName}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Name" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">A - Z</SelectItem>
                  <SelectItem value="desc">Z - A</SelectItem>
                </SelectContent>
              </Select>
              {nameFilterLabel ? <ActiveFilterChip label={nameFilterLabel} /> : null}
            </div>

            <div className={dateFilterLabel ? "space-y-2" : undefined}>
              <Select value={filterDate} onValueChange={setFilterDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
              {dateFilterLabel ? <ActiveFilterChip label={dateFilterLabel} /> : null}
            </div>

            <div className={typeFilterLabel ? "space-y-2" : undefined}>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                  <SelectItem value="inquiry">Inquiry</SelectItem>
                  <SelectItem value="request">Request</SelectItem>
                  <SelectItem value="compliment">Compliment</SelectItem>
                </SelectContent>
              </Select>
              {typeFilterLabel ? <ActiveFilterChip label={typeFilterLabel} /> : null}
            </div>

            <div className={priorityFilterLabel ? "space-y-2" : undefined}>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              {priorityFilterLabel ? (
                <ActiveFilterChip label={priorityFilterLabel} />
              ) : null}
            </div>

            <div className={statusFilterLabel ? "space-y-2" : undefined}>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inprogress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              {statusFilterLabel ? <ActiveFilterChip label={statusFilterLabel} /> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isFeedbacksLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading feedback submissions...
            </div>
          ) : visibleFeedbacks.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No Feedback Found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters for this unit.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
              <Table className="min-w-[980px] text-xs sm:text-sm [&_td]:px-3 [&_th]:px-3">
                <TableHeader className="bg-muted/50">
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Tracking ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[150px] whitespace-nowrap">Date</TableHead>
                    <TableHead className="w-[110px] text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFeedbacks.map((feedback) => (
                    <TableRow key={feedback.id}>
                      <TableCell className="font-mono text-sm">
                        {feedback.isAnonymous
                          ? "*****"
                          : feedback.userName
                            ? feedback.userName.split(" ")[0]
                            : "*****"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {feedback.id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {feedback.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{feedback.category}</TableCell>
                      <TableCell>
                        <Badge
                          className={getPriorityColor(feedback.priority)}
                          variant="outline"
                        >
                          {feedback.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getStatusColor(feedback.status)}
                          variant="outline"
                        >
                          {feedback.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatSubmittedAt(feedback.createdAt)}
                      </TableCell>
                      <TableCell className="w-[110px] pr-3">
                        <div className="flex justify-end">
                          <Dialog
                            open={
                              isEditDialogOpen &&
                              selectedFeedback?.id === feedback.id
                            }
                            onOpenChange={(open) => {
                              if (!open) {
                                setIsEditDialogOpen(false);
                                setActiveEditTab("details");
                                setSelectedFeedback(null);
                                setMessages([]);
                                setMessageDraft("");
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void openFeedbackDialog(feedback)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent
                              className={
                                activeEditTab === "manage"
                                  ? "flex h-[85vh] w-full max-h-[85vh] max-w-2xl flex-col overflow-hidden"
                                  : "w-full max-h-[80vh] max-w-2xl overflow-x-hidden overflow-y-auto"
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
                                className={
                                  activeEditTab === "manage"
                                    ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
                                    : "w-full min-w-0"
                                }
                              >
                                <TabsList className="grid w-full shrink-0 grid-cols-2">
                                  <TabsTrigger value="details">
                                    Details
                                  </TabsTrigger>
                                  <TabsTrigger value="manage">Manage</TabsTrigger>
                                </TabsList>

                                <TabsContent
                                  value="details"
                                  className="space-y-4 min-w-0 overflow-x-hidden"
                                >
                                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                      <Label className="text-muted-foreground">
                                        Type
                                      </Label>
                                      <p className="font-medium capitalize">
                                        {selectedFeedback.type}
                                      </p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">
                                        Category
                                      </Label>
                                      <p className="font-medium break-words [overflow-wrap:anywhere]">
                                        {selectedFeedback.category}
                                      </p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">
                                        Status
                                      </Label>
                                      <Badge
                                        className={getStatusColor(
                                          selectedFeedback.status,
                                        )}
                                        variant="outline"
                                      >
                                        {selectedFeedback.status}
                                      </Badge>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">
                                        Submitted By
                                      </Label>
                                      <p className="font-medium">
                                        {selectedFeedback.isAnonymous
                                          ? "*****"
                                          : selectedFeedback.userName || "*****"}
                                      </p>
                                    </div>
                                  </div>

                                  <div>
                                    <Label className="text-muted-foreground">
                                      Subject
                                    </Label>
                                    <p className="font-medium break-words [overflow-wrap:anywhere]">
                                      {selectedFeedback.subject}
                                    </p>
                                  </div>

                                  <div>
                                    <Label className="text-muted-foreground">
                                      Message
                                    </Label>
                                    <div className="mt-2 w-full min-w-0 rounded-lg bg-muted p-4 overflow-hidden">
                                      <p
                                        className="max-w-full whitespace-pre-wrap text-sm leading-relaxed"
                                        style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                                      >
                                        {displayedSelectedMessage}
                                      </p>
                                      {canExpandSelectedMessage ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setIsDetailsMessageExpanded(
                                              (current) => !current,
                                            )
                                          }
                                          className="mt-2 text-xs font-medium text-accent hover:underline"
                                        >
                                          {isDetailsMessageExpanded
                                            ? "See less"
                                            : "See all"}
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>

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
                                            {messages.map((entry) => {
                                              const isAdminMessage =
                                                entry.senderRole !== "user";
                                              const hasVeryLongToken =
                                                /\S{24,}/.test(entry.message || "");
                                              return (
                                                <div
                                                  key={entry.id}
                                                  className={`flex ${isAdminMessage ? "justify-end" : "justify-start"}`}
                                                >
                                                  <div
                                                    className={`max-w-[62%] sm:max-w-[12rem] ${isAdminMessage ? "text-right" : "text-left"}`}
                                                  >
                                                    <p className="mb-0.5 px-1 text-[11px] font-semibold text-muted-foreground">
                                                      {isAdminMessage
                                                        ? "You"
                                                        : entry.senderName || "User"}
                                                    </p>
                                                    <div
                                                      className={`rounded-2xl px-2.5 py-1.5 text-[13px] shadow-sm ${
                                                        isAdminMessage
                                                          ? "bg-accent text-white"
                                                          : "border border-border bg-white text-foreground"
                                                      }`}
                                                    >
                                                      <p
                                                        className={`whitespace-pre-line leading-relaxed ${
                                                          hasVeryLongToken
                                                            ? "break-all"
                                                            : "break-words"
                                                        }`}
                                                      >
                                                        {entry.message}
                                                      </p>
                                                    </div>
                                                    {entry.createdAt ? (
                                                      <p className="mt-0.5 px-1 text-[10px] text-muted-foreground">
                                                        {formatLocalTime(
                                                          entry.createdAt,
                                                        )}
                                                      </p>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>

                                        <div className="shrink-0 bg-background/85 px-4 pb-4 pt-2 backdrop-blur-sm">
                                          <div className="flex items-center gap-2">
                                            <div className="flex min-h-[40px] flex-1 items-center rounded-full bg-[#eef4ff] px-4">
                                            <Textarea
                                              ref={replyInputRef}
                                              id="message"
                                              placeholder="Type your reply..."
                                              rows={1}
                                                value={messageDraft}
                                                onChange={(event) =>
                                                  setMessageDraft(event.target.value)
                                                }
                                                onKeyDown={(event) => {
                                                  if (
                                                    event.key === "Enter" &&
                                                    !event.shiftKey
                                                  ) {
                                                    event.preventDefault();
                                                    void handleSendMessage();
                                                  }
                                                }}
                                                className="max-h-16 min-h-0 flex-1 resize-none border-0 bg-transparent px-0 py-1.5 text-sm shadow-none focus-visible:ring-0"
                                              />
                                            </div>
                                            <Button
                                              type="button"
                                              size="icon"
                                              className="h-10 w-10 shrink-0 rounded-2xl bg-[#eef4ff] text-muted-foreground hover:bg-[#e1ebff]"
                                              onMouseDown={(event) => event.preventDefault()}
                                              onClick={() => void handleSendMessage()}
                                              disabled={
                                                isSendingMessage ||
                                                !messageDraft.trim()
                                              }
                                              aria-label={
                                                isSendingMessage
                                                  ? "Sending reply"
                                                  : "Send reply"
                                              }
                                            >
                                              <SendHorizontal className="h-5 w-5" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <Button
                                    onClick={handleUpdateFeedback}
                                    className="mt--8 w-full bg-accent hover:bg-accent/90"
                                    disabled={!hasFeedbackChanges}
                                  >
                                    Update Feedback
                                  </Button>
                                  <p className="pt-1 text-center text-xs text-muted-foreground">
                                    Marking a submission as Resolved will email
                                    the user if they registered an account.
                                  </p>
                                </TabsContent>
                              </Tabs>
                            ) : null}
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}