"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  listCategories,
  listFeedbacks,
  listFeedbackMessages,
  createFeedbackMessage,
  getSessionMe,
  updateFeedback,
  type Feedback,
  type FeedbackMessage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CardDescription,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { parseAdminResponses } from "@/lib/responseLog";
import { formatLocalTime } from "@/lib/time";
import { toastApiError } from "@/lib/errorHandling";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Pencil,
  Search,
  UserCircle2,
} from "lucide-react";

interface AdminRecord {
  id: string;
  unit?: string;
  department?: string;
}

const SESSION_EVENT = "feedforward:session-change";
const OPEN_FEEDBACK_EVENT = "feedforward:open-feedback";

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
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export default function AdminDashboard() {
  const router = useRouter();
  const [currentAdmin, setCurrentAdmin] = useState<{
    id: string;
    name: string;
    email: string;
    unit: string;
  } | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [pendingOpenFeedbackId, setPendingOpenFeedbackId] = useState("");
  const lastSessionPingRef = useRef(0);
  const applyFeedbackUpdate = useCallback((data: Feedback[]) => {
    setFeedbacks(data);
    if (typeof window === "undefined") return;
    if (!currentAdmin?.unit) return;
    const key = `adminFeedbacksCache:${currentAdmin.unit}`;
    sessionStorage.setItem(key, JSON.stringify(data));
  }, [currentAdmin]);

  async function loadFeedbacks(unit: string) {
    if (!unit.trim()) {
      return;
    }

    try {
      const data = await listFeedbacks({ category: unit });
      applyFeedbackUpdate(data);
    } catch (error) {
      toastApiError(error, "Failed to load feedbacks.");
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isLoggedIn = localStorage.getItem("isAdminLoggedIn");
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setCurrentAdmin({
      id: localStorage.getItem("currentAdminId") || "",
      name: localStorage.getItem("currentAdminName") || "",
      email: localStorage.getItem("currentAdminEmail") || "",
      unit: localStorage.getItem("currentAdminDepartment") || "",
    });
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pingSession = () => {
      const now = Date.now();
      if (now - lastSessionPingRef.current < 4000) return;
      lastSessionPingRef.current = now;
      void getSessionMe().catch(() => {
        // apiFetch handles session expiry redirect
      });
    };

    const events: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "touchstart",
      "pointerdown",
      "focus",
    ];
    events.forEach((eventName) =>
      window.addEventListener(eventName, pingSession, { passive: true }),
    );

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        pingSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const intervalId = window.setInterval(() => {
      pingSession();
    }, 60000);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, pingSession),
      );
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentAdmin?.unit) return;
    const key = `adminFeedbacksCache:${currentAdmin.unit}`;
    const cached = sessionStorage.getItem(key);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        applyFeedbackUpdate(parsed as Feedback[]);
      }
    } catch {
      // Ignore cache parse errors
    }
  }, [currentAdmin?.unit, applyFeedbackUpdate]);

  useEffect(() => {
    if (!currentAdmin?.unit) return;

    void listFeedbacks({ category: currentAdmin.unit })
      .then((data) => {
        startTransition(() => {
          applyFeedbackUpdate(data);
        });
      })
      .catch((error) => {
        toastApiError(error, "Failed to load feedbacks.");
      });
  }, [currentAdmin?.unit, applyFeedbackUpdate]);

  useEffect(() => {
    void listCategories()
      .then((data) => {
        setCategories(data.map((category) => category.name));
      })
      .catch((error) => {
        toastApiError(error, "Failed to load categories.");
      });
  }, []);

  const loadMessages = useCallback(
    async (feedbackId: string) => {
      setIsMessagesLoading(true);
      try {
        const data = await listFeedbackMessages(feedbackId);
        setMessages(data);
      } catch (error) {
        toastApiError(error, "Failed to load messages.");
      } finally {
        setIsMessagesLoading(false);
      }
    },
    [],
  );

  const handleSendMessage = useCallback(async () => {
    if (!selectedFeedback) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) return;

    setIsSendingMessage(true);
    try {
      await createFeedbackMessage(selectedFeedback.id, { message: trimmed });
      setMessageDraft("");
      await loadMessages(selectedFeedback.id);
    } catch (error) {
      toastApiError(error, "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  }, [messageDraft, loadMessages, selectedFeedback]);

  const openFeedbackById = useCallback(
    (feedbackId: string) => {
      const target = feedbacks.find((item) => item.id === feedbackId);
      if (!target) {
        setPendingOpenFeedbackId(feedbackId);
        return;
      }
      setSelectedFeedback(target);
      setNewStatus(target.status);
      setNewPriority(target.priority);
      setIsEditDialogOpen(true);
      void loadMessages(target.id);
      if (currentAdmin?.id && currentAdmin.unit) {
        markAdminNotificationAsRead(currentAdmin.id, currentAdmin.unit, target.id);
      }
      setPendingOpenFeedbackId("");
    },
    [feedbacks, loadMessages, currentAdmin?.id, currentAdmin?.unit],
  );

  useEffect(() => {
    const handleOpenFeedback = (event: Event) => {
      const customEvent = event as CustomEvent<{ feedbackId?: string }>;
      const feedbackId = customEvent.detail?.feedbackId;
      if (!feedbackId) return;
      openFeedbackById(feedbackId);
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
    if (!pendingOpenFeedbackId) return;
    openFeedbackById(pendingOpenFeedbackId);
  }, [pendingOpenFeedbackId, openFeedbackById]);

  const handleUpdateFeedback = async () => {
    if (!selectedFeedback) return;

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
      if (currentAdmin?.unit) {
        await loadFeedbacks(currentAdmin.unit);
      }
      toast.success("Feedback updated successfully");
      setSelectedFeedback(null);
      setNewStatus("");
      setNewPriority("");
      setIsEditDialogOpen(false);
    } catch (error) {
      toastApiError(error, "Failed to update feedback.");
    }
  };

  const handleUnitChange = () => {
    if (!newUnit || newUnit === currentAdmin?.unit) return;

    const admins: AdminRecord[] = JSON.parse(localStorage.getItem("admins") || "[]");
    const unitTaken = admins.some(
      (a) =>
        (a.unit === newUnit || a.department === newUnit) &&
        a.id !== currentAdmin?.id,
    );
    if (unitTaken) {
      toast.error("This unit already has an admin. Change is not allowed.");
      return;
    }

    const updatedAdmins = admins.map((a) =>
      a.id === currentAdmin?.id
        ? { ...a, unit: newUnit, department: newUnit }
        : a,
    );
    localStorage.setItem("admins", JSON.stringify(updatedAdmins));
    localStorage.setItem("currentAdminDepartment", newUnit);

    const updatedAdmin = { ...currentAdmin!, unit: newUnit };
    setCurrentAdmin(updatedAdmin);
    setNewUnit("");
    setIsProfileOpen(false);
    toast.success("Unit updated successfully!");
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

  const stats = {
    total: feedbacks.length,
    pending: feedbacks.filter((f) => f.status === "Pending").length,
    inProgress: feedbacks.filter((f) => f.status === "In Progress").length,
    resolved: feedbacks.filter((f) => f.status === "Resolved").length,
  };

  const filteredFeedbacks = feedbacks
    .filter((feedback) => {
      const matchesSearch =
        feedback.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feedback.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feedback.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || feedback.type === filterType;
      // FIX: use regex replace to remove ALL spaces for comparison
      const matchesStatus =
        filterStatus === "all" ||
        feedback.status.toLowerCase().replace(/\s+/g, "") === filterStatus;
      const matchesPriority =
        filterPriority === "all" ||
        feedback.priority?.toLowerCase() === filterPriority;
      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesPriority
      );
    })
    .sort((a, b) => {
      if (filterDate === "recent") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (filterDate === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      if (filterName === "all" || filterName === "") return 0;
      const nameA = (
        a.isAnonymous ? "*****" : a.userName || "*****"
      ).toLowerCase();
      const nameB = (
        b.isAnonymous ? "*****" : b.userName || "*****"
      ).toLowerCase();
      return filterName === "asc"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });

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

  const formatAdminTime = formatLocalTime;

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

  const createPdfLogoDataUrl = () => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 120;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = "miter";
    ctx.lineCap = "square";

    ctx.strokeStyle = "#ff9500";
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(140, 18);
    ctx.lineTo(196, 60);
    ctx.lineTo(140, 102);
    ctx.stroke();

    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(24, 60);
    ctx.lineTo(126, 60);
    ctx.moveTo(78, 18);
    ctx.lineTo(126, 60);
    ctx.lineTo(78, 102);
    ctx.stroke();

    return canvas.toDataURL("image/png");
  };

  const exportFeedbacksPdf = () => {
    const brandOrange: [number, number, number] = [255, 149, 0];
    const brandDark: [number, number, number] = [17, 24, 39];
    const brandMuted: [number, number, number] = [107, 114, 128];
    const brandBorder: [number, number, number] = [210, 214, 220];
    const reportSurface: [number, number, number] = [248, 249, 251];
    const reportSurfaceAlt: [number, number, number] = [242, 244, 247];
    const rows = filteredFeedbacks.map((feedback) => ({
      id: feedback.id,
      type: feedback.type,
      status: feedback.status,
      priority: feedback.priority,
      submitted: formatSubmittedAt(feedback.createdAt),
      subject: feedback.subject,
      message: feedback.message,
    }));

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

    const filterSummary = filterParts.length
      ? filterParts.join(" | ")
      : "No filters applied";

    const nowText = new Date().toLocaleString("en-US");
    const fileName = `${buildFileNameBase()}.pdf`;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const logoDataUrl = createPdfLogoDataUrl();
    const logoWidth = 76;
    const logoHeight = 42;
    const logoY = 24;
    const titleY = 90;
    const generatedY = 108;
    const filterY = 124;
    const tableStartY = 152;

    if (logoDataUrl) {
      doc.addImage(
        logoDataUrl,
        "PNG",
        pageWidth / 2 - logoWidth / 2,
        logoY,
        logoWidth,
        logoHeight,
      );
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...brandDark);
    doc.text("FeedForward - Feedback Report", pageWidth / 2, titleY, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...brandMuted);
    doc.text(`Generated Date: ${nowText}`, pageWidth / 2, generatedY, {
      align: "center",
    });
    doc.text(`Filter: ${filterSummary}`, pageWidth / 2, filterY, {
      align: "center",
      maxWidth: pageWidth - 120,
    });
    doc.setDrawColor(...brandOrange);
    doc.setLineWidth(1);
    doc.line(80, filterY + 14, pageWidth - 80, filterY + 14);

    if (!rows.length) {
      doc.setTextColor(...brandOrange);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        "No feedback submissions match the current filters.",
        pageWidth / 2,
        tableStartY + 24,
        { align: "center" },
      );
      doc.save(fileName);
      return;
    }

    const body: Array<
      Array<string> | Array<{
        content: string;
        colSpan: number;
        styles?: Record<string, string | number | number[]>;
      }>
    > = [];

    rows.forEach((row) => {
      body.push([
        row.id,
        row.type,
        row.status,
        row.priority,
        row.submitted,
        row.subject,
      ]);
      body.push([
        {
          content: `Message: ${row.message}`,
          colSpan: 6,
          styles: { fontStyle: "italic", textColor: [55, 65, 81] },
        },
      ]);
      body.push([
        {
          content: "",
          colSpan: 6,
          styles: { cellPadding: 0, minCellHeight: 4 },
        },
      ]);
    });

    const tableWidth = 70 + 70 + 80 + 70 + 110 + 220;
    const leftMargin = Math.max(40, (pageWidth - tableWidth) / 2);

    autoTable(doc, {
      startY: tableStartY,
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
      margin: { left: leftMargin, right: leftMargin },
      styles: {
        fontSize: 9,
        cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
        valign: "top",
        lineColor: brandBorder,
        lineWidth: 0.25,
        textColor: brandDark,
        fillColor: [255, 255, 255],
      },
      headStyles: {
        fillColor: brandDark,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
        halign: "center",
        valign: "middle",
        cellPadding: { top: 9, right: 10, bottom: 9, left: 10 },
        lineColor: brandDark,
        lineWidth: 0.4,
      },
      alternateRowStyles: { fillColor: reportSurfaceAlt },
      columnStyles: {
        0: {
          cellWidth: 82,
          fontStyle: "bold",
        },
        1: {
          cellWidth: 72,
          halign: "center",
        },
        2: {
          cellWidth: 88,
          halign: "center",
        },
        3: {
          cellWidth: 74,
          halign: "center",
        },
        4: {
          cellWidth: 118,
          halign: "center",
        },
        5: { cellWidth: 206 },
      },
      didParseCell: (data) => {
        const isMessageRow =
          data.section === "body" &&
          Array.isArray(data.row.raw) &&
          data.row.raw.length === 1 &&
          typeof data.row.raw[0] === "object" &&
          data.row.raw[0] !== null &&
          "content" in data.row.raw[0] &&
          String(data.row.raw[0].content).startsWith("Message:");

        if (isMessageRow) {
          data.cell.styles.fillColor = reportSurface;
          data.cell.styles.textColor = brandMuted;
          data.cell.styles.fontStyle = "normal";
          data.cell.styles.cellPadding = {
            top: 8,
            right: 10,
            bottom: 10,
            left: 10,
          };
        }

        const isSpacerRow =
          data.section === "body" &&
          Array.isArray(data.row.raw) &&
          data.row.raw.length === 1 &&
          typeof data.row.raw[0] === "object" &&
          data.row.raw[0] !== null &&
          "content" in data.row.raw[0] &&
          String(data.row.raw[0].content) === "";

        if (isSpacerRow) {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.lineColor = [255, 255, 255];
          data.cell.styles.lineWidth = 0;
        }
      },
    });

    doc.save(fileName);
  };

  const exportFeedbacksXlsx = async () => {
    const ExcelJS = (await import("exceljs")) as typeof import("exceljs");
    const brandOrangeArgb = "FFFF9500";
    const brandDarkArgb = "FF111827";
    const brandMutedArgb = "FF6B7280";
    const brandBorderArgb = "FFD2D6DC";
    const reportSurfaceArgb = "FFF8F9FB";
    const reportSurfaceAltArgb = "FFF2F4F7";
    const reportColumns = ["A", "B", "C", "D", "E", "F"] as const;
    const reportColumnWidths = [18, 14, 16, 12, 22, 42] as const;
    const thinBorder = {
      top: { style: "thin" as const, color: { argb: brandBorderArgb } },
      left: { style: "thin" as const, color: { argb: brandBorderArgb } },
      bottom: { style: "thin" as const, color: { argb: brandBorderArgb } },
      right: { style: "thin" as const, color: { argb: brandBorderArgb } },
    };
    const excelColumnWidthToPixels = (width: number) => Math.floor(width * 7 + 5);
    const getCenteredImageColumnOffset = (
      columnWidths: readonly number[],
      imageWidthPx: number,
    ) => {
      const totalWidthPx = columnWidths.reduce(
        (sum, width) => sum + excelColumnWidthToPixels(width),
        0,
      );
      let remainingOffsetPx = Math.max(0, (totalWidthPx - imageWidthPx) / 2);

      for (let index = 0; index < columnWidths.length; index += 1) {
        const columnWidthPx = excelColumnWidthToPixels(columnWidths[index]);
        if (remainingOffsetPx <= columnWidthPx) {
          return index + remainingOffsetPx / columnWidthPx;
        }
        remainingOffsetPx -= columnWidthPx;
      }

      return 0;
    };
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "FeedForward";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Feedback Report", {
      views: [{ showGridLines: false }],
    });

    worksheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    };

    worksheet.columns = [
      { key: "id", width: reportColumnWidths[0] },
      { key: "type", width: reportColumnWidths[1] },
      { key: "status", width: reportColumnWidths[2] },
      { key: "priority", width: reportColumnWidths[3] },
      { key: "submitted", width: reportColumnWidths[4] },
      { key: "subject", width: reportColumnWidths[5] },
    ];

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

    const filterSummary = filterParts.length
      ? filterParts.join(" | ")
      : "No filters applied";

    const nowText = new Date().toLocaleString("en-US");
    const logoDataUrl = createPdfLogoDataUrl();
    if (logoDataUrl) {
      const logoWidthPx = 76;
      const logoColumnOffset = getCenteredImageColumnOffset(
        reportColumnWidths,
        logoWidthPx,
      );
      const imageId = workbook.addImage({
        base64: logoDataUrl,
        extension: "png",
      });
      worksheet.addImage(imageId, {
        tl: { col: logoColumnOffset, row: 0.2 },
        ext: { width: logoWidthPx, height: 42 },
      });
    }

    worksheet.mergeCells("A4:F4");
    worksheet.mergeCells("A5:F5");
    worksheet.mergeCells("A6:F6");
    worksheet.mergeCells("A7:F7");

    worksheet.getCell("A4").value = "FeedForward - Feedback Report";
    worksheet.getCell("A5").value = `Generated Date: ${nowText}`;
    worksheet.getCell("A6").value = `Filter: ${filterSummary}`;

    worksheet.getCell("A4").font = {
      bold: true,
      size: 16,
      color: { argb: brandDarkArgb },
    };
    worksheet.getCell("A5").font = {
      size: 10,
      color: { argb: brandMutedArgb },
    };
    worksheet.getCell("A6").font = {
      size: 10,
      color: { argb: brandMutedArgb },
    };

    ["A4", "A5", "A6"].forEach((cellRef) => {
      worksheet.getCell(cellRef).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    });

    reportColumns.forEach((column) => {
      const dividerCell = worksheet.getCell(`${column}7`);
      dividerCell.border = {
        bottom: { style: "medium", color: { argb: brandOrangeArgb } },
      };
    });

    worksheet.getRow(1).height = 24;
    worksheet.getRow(2).height = 18;
    worksheet.getRow(3).height = 12;
    worksheet.getRow(4).height = 24;
    worksheet.getRow(5).height = 18;
    worksheet.getRow(6).height = 30;
    worksheet.getRow(7).height = 10;

    const tableHeaderRowNumber = 9;
    const headerRow = worksheet.getRow(tableHeaderRowNumber);
    headerRow.values = [
      "TRACKING ID",
      "TYPE",
      "STATUS",
      "PRIORITY",
      "SUBMITTED ON",
      "SUBJECT",
    ];
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        size: 9,
        color: { argb: "FFFFFFFF" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: brandDarkArgb },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      cell.border = {
        top: { style: "thin", color: { argb: brandDarkArgb } },
        left: { style: "thin", color: { argb: brandDarkArgb } },
        bottom: { style: "thin", color: { argb: brandDarkArgb } },
        right: { style: "thin", color: { argb: brandDarkArgb } },
      };
    });

    let currentRowNumber = tableHeaderRowNumber + 1;

    if (filteredFeedbacks.length === 0) {
      worksheet.mergeCells(`A${currentRowNumber}:F${currentRowNumber}`);
      const noteCell = worksheet.getCell(`A${currentRowNumber}`);
      noteCell.value = "No feedback submissions match the current filters.";
      noteCell.font = {
        bold: true,
        color: { argb: brandOrangeArgb },
      };
      noteCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      worksheet.getRow(currentRowNumber).height = 24;
    } else {
      filteredFeedbacks.forEach((feedback, index) => {
        const dataRow = worksheet.getRow(currentRowNumber);
        dataRow.values = [
          feedback.id,
          feedback.type,
          feedback.status,
          feedback.priority,
          formatSubmittedAt(feedback.createdAt),
          feedback.subject,
        ];
        dataRow.height = 34;
        dataRow.eachCell((cell, colNumber) => {
          cell.font = {
            bold: colNumber === 1,
            color: { argb: brandDarkArgb },
          };
          cell.alignment = {
            vertical: "top",
            wrapText: true,
            horizontal:
              colNumber >= 2 && colNumber <= 5 ? "center" : "left",
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: index % 2 === 0 ? "FFFFFFFF" : reportSurfaceAltArgb,
            },
          };
          cell.border = thinBorder;
        });

        currentRowNumber += 1;
        worksheet.mergeCells(`A${currentRowNumber}:F${currentRowNumber}`);
        const messageRow = worksheet.getRow(currentRowNumber);
        const messageCell = worksheet.getCell(`A${currentRowNumber}`);
        messageCell.value = `Message: ${feedback.message}`;
        messageCell.font = {
          size: 10,
          color: { argb: brandMutedArgb },
        };
        messageCell.alignment = {
          vertical: "top",
          wrapText: true,
        };
        messageRow.height = 28;
        reportColumns.forEach((column) => {
          const cell = worksheet.getCell(`${column}${currentRowNumber}`);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: reportSurfaceArgb },
          };
          cell.border = thinBorder;
        });

        currentRowNumber += 1;
        worksheet.mergeCells(`A${currentRowNumber}:F${currentRowNumber}`);
        const spacerRow = worksheet.getRow(currentRowNumber);
        spacerRow.height = 6;
        reportColumns.forEach((column) => {
          const cell = worksheet.getCell(`${column}${currentRowNumber}`);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFFFF" },
          };
          cell.border = {};
        });

        currentRowNumber += 1;
      });
    }

    worksheet.views = [
      { state: "frozen", ySplit: tableHeaderRowNumber, showGridLines: false },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${buildFileNameBase()}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted">
      {/* Header */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-5 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-sm text-primary-foreground/80 sm:text-base">
                {currentAdmin?.name && (
                  <span className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4" />
                    <span>
                      {currentAdmin.name} &mdash; {currentAdmin.unit}
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardDescription>Total Feedback</CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">
                {stats.total}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>All submissions</span>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl text-yellow-600 sm:text-3xl">
                {stats.pending}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Awaiting review</span>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-2xl text-blue-600 sm:text-3xl">
                {stats.inProgress}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Being addressed</span>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-2xl text-green-600 sm:text-3xl">
                {stats.resolved}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4" />
                <span>Completed</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
              Search &amp; Filter
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={exportFeedbacksPdf}
                className="w-full sm:w-auto"
              >
                Export PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={exportFeedbacksXlsx}
                className="w-full sm:w-auto"
              >
                Export XLSX
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:col-span-2 lg:col-span-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search by ID, subject, or message..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterName} onValueChange={setFilterName}>
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Name" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">A - Z</SelectItem>
                    <SelectItem value="desc">Z - A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full">
                <Select value={filterDate} onValueChange={setFilterDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full">
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
              </div>
              <div className="w-full">
                <Select
                  value={filterPriority}
                  onValueChange={setFilterPriority}
                >
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
              </div>
              <div className="w-full">
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
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Table */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Feedback Submissions
              </CardTitle>
              <CardDescription>
                Showing {filteredFeedbacks.length} of {feedbacks.length}{" "}
                submissions
                {currentAdmin?.unit && ` for ${currentAdmin.unit}`}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {filteredFeedbacks.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Feedback Found
                </h3>
                <p className="text-muted-foreground">
                  {feedbacks.length === 0
                    ? `No feedback submissions yet for ${currentAdmin?.unit}.`
                    : "Try adjusting your search or filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table className="min-w-[980px] text-xs sm:text-sm [&_th]:px-3 [&_td]:px-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Tracking ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="whitespace-nowrap w-[150px]">
                        Date
                      </TableHead>
                      <TableHead className="text-right w-[110px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeedbacks.map((feedback) => (
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
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {(() => {
                            const date = new Date(feedback.createdAt);
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
                          })()}
                        </TableCell>
                        <TableCell className="text-right w-[110px]">
                          <Dialog
                            open={
                              isEditDialogOpen &&
                              selectedFeedback?.id === feedback.id
                            }
                            onOpenChange={(open) => {
                              if (!open) {
                                setIsEditDialogOpen(false);
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
                                onClick={() => {
                                  setSelectedFeedback(feedback);
                                  setNewStatus(feedback.status);
                                  setNewPriority(feedback.priority);
                                  setIsEditDialogOpen(true);
                                  void loadMessages(feedback.id);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Feedback Details</DialogTitle>
                                <DialogDescription>
                                  Tracking ID: {selectedFeedback?.id}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedFeedback && (
                                <Tabs defaultValue="details" className="w-full">
                                  <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="details">
                                      Details
                                    </TabsTrigger>
                                    <TabsTrigger value="manage">
                                      Manage
                                    </TabsTrigger>
                                  </TabsList>
                                  <TabsContent
                                    value="details"
                                    className="space-y-4 ff-tab-panel-left"
                                  >
                                    <div className="grid grid-cols-2 gap-4">
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
                                        <p className="font-medium">
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
                                          Submitted
                                        </Label>
                                        <p className="font-medium">
                                          {new Date(
                                            selectedFeedback.createdAt,
                                          ).toLocaleString("en-US")}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Submitted By
                                        </Label>
                                        <p className="font-medium">
                                          {selectedFeedback.isAnonymous
                                            ? "*****"
                                            : selectedFeedback.userName ||
                                              "*****"}
                                        </p>
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">
                                        Subject
                                      </Label>
                                      <p className="font-medium">
                                        {selectedFeedback.subject}
                                      </p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">
                                        Message
                                      </Label>
                                      <div className="bg-muted rounded-lg p-4 mt-2">
                                        <p className="text-sm whitespace-pre-wrap">
                                          {selectedFeedback.message}
                                        </p>
                                      </div>
                                    </div>
                                    {selectedFeedback.response && (
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Current Response
                                        </Label>
                                        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mt-2 max-h-[260px] overflow-y-auto">
                                          <div className="space-y-3">
                                            {parseAdminResponses(
                                              selectedFeedback.response,
                                            ).map((entry, index) => (
                                              <div
                                                key={`${entry.time ?? "note"}-${index}`}
                                              >
                                                {entry.time && (
                                                  <p className="text-[10px] font-semibold text-muted-foreground">
                                                    {entry.author && (
                                                      <span className="text-[11px] text-foreground">
                                                        {entry.author}
                                                      </span>
                                                    )}
                                                    {entry.author ? " " : ""}
                                                    {formatAdminTime(entry.time)}
                                                  </p>
                                                )}
                                                <p className="text-sm text-foreground/90 leading-relaxed">
                                                  {entry.message}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </TabsContent>
                                  <TabsContent
                                    value="manage"
                                    className="space-y-4 ff-tab-panel-right"
                                  >
                                    <div className="space-y-2">
                                      <Label htmlFor="status">
                                        Update Status
                                      </Label>
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
                                          <SelectItem value="Low">
                                            Low
                                          </SelectItem>
                                          <SelectItem value="Medium">
                                            Medium
                                          </SelectItem>
                                          <SelectItem value="High">
                                            High
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5 text-foreground" />
                                        <p className="text-base font-semibold">
                                          Conversation
                                        </p>
                                      </div>
                                      <div className="overflow-hidden rounded-lg border border-border bg-white/70">
                                        <div className="max-h-[300px] overflow-y-auto p-4">
                                          {isMessagesLoading && (
                                            <p className="text-sm text-muted-foreground">
                                              Loading conversation...
                                            </p>
                                          )}
                                          {!isMessagesLoading &&
                                            messages.length === 0 && (
                                              <p className="text-sm text-muted-foreground">
                                                No messages yet.
                                              </p>
                                            )}
                                          <div className="space-y-4">
                                            {(() => {
                                              let lastDayLabel = "";
                                              return messages.map((entry) => {
                                                const createdAt = entry.createdAt
                                                  ? new Date(entry.createdAt)
                                                  : null;
                                                const today = new Date();
                                                const dayLabel = createdAt
                                                  ? createdAt.toDateString() ===
                                                    today.toDateString()
                                                    ? "Today"
                                                    : createdAt.toLocaleDateString(
                                                        undefined,
                                                        {
                                                          month: "short",
                                                          day: "numeric",
                                                          year: "numeric",
                                                        },
                                                      )
                                                  : "";
                                                const showDayLabel =
                                                  dayLabel &&
                                                  dayLabel !== lastDayLabel;
                                                if (showDayLabel) {
                                                  lastDayLabel = dayLabel;
                                                }

                                                const isAdmin =
                                                  entry.senderRole !== "user";
                                                const name = isAdmin
                                                  ? "You"
                                                  : entry.senderName || "User";
                                                return (
                                                  <div
                                                    key={entry.id}
                                                    className="space-y-3"
                                                  >
                                                    {showDayLabel && (
                                                      <div className="flex justify-center">
                                                        <span className="rounded-full border border-border bg-white/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                                                          {dayLabel}
                                                        </span>
                                                      </div>
                                                    )}
                                                    <div
                                                      className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                                                    >
                                                      <div
                                                        className={`max-w-[75%] rounded-lg px-4 py-3 text-sm shadow-sm ${
                                                          isAdmin
                                                            ? "bg-accent text-white"
                                                            : "bg-muted/60 text-foreground border border-border"
                                                        }`}
                                                      >
                                                        <p className="text-[11px] font-semibold opacity-80">
                                                          {name}
                                                          {entry.createdAt && (
                                                            <span className="font-normal">
                                                              {" "}
                                                              · {formatAdminTime(entry.createdAt)}
                                                            </span>
                                                          )}
                                                        </p>
                                                        <p className="mt-1 whitespace-pre-wrap">
                                                          {entry.message}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              });
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-sm font-semibold">
                                          Send a reply
                                        </Label>
                                        <div className="flex items-center gap-3">
                                          <Input
                                            id="message"
                                            placeholder="Type your message..."
                                            value={messageDraft}
                                            onChange={(e) =>
                                              setMessageDraft(e.target.value)
                                            }
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter") {
                                                event.preventDefault();
                                                void handleSendMessage();
                                              }
                                            }}
                                            className="h-11 rounded-lg bg-muted/50"
                                          />
                                          <Button
                                            type="button"
                                            className="h-11 px-6"
                                            onClick={() => void handleSendMessage()}
                                            disabled={
                                              isSendingMessage ||
                                              !messageDraft.trim()
                                            }
                                          >
                                            {isSendingMessage ? "Sending..." : "Send"}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Marking a submission as Resolved will
                                      email the user if they registered an
                                      account.
                                    </p>
                                    <Button
                                      onClick={handleUpdateFeedback}
                                      className="w-full bg-accent hover:bg-accent/90"
                                    >
                                      Update Feedback
                                    </Button>
                                  </TabsContent>
                                </Tabs>
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin Profile Sheet */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent className="w-[360px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Admin Profile</SheetTitle>
            <SheetDescription>Your account information</SheetDescription>
          </SheetHeader>
          <div className="mt-8 space-y-6">
            <div className="flex flex-col items-center gap-3 pb-6 border-b">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle2 className="h-12 w-12 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{currentAdmin?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {currentAdmin?.unit}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Full Name
                </p>
                <p className="font-medium">{currentAdmin?.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Email
                </p>
                <p className="font-medium">{currentAdmin?.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Current Unit
                </p>
                <p className="font-medium">{currentAdmin?.unit}</p>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t">
              <div>
                <p className="text-sm font-semibold mb-1">Change Unit</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Each unit can only have one admin. If the selected unit is
                  already taken, the change will be rejected.
                </p>
              </div>
              <Select value={newUnit} onValueChange={setNewUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full bg-accent hover:bg-accent/90"
                onClick={handleUnitChange}
                disabled={!newUnit || newUnit === currentAdmin?.unit}
              >
                Save Unit
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}