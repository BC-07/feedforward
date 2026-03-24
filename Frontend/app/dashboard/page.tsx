"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listCategories,
  listFeedbacks,
  updateFeedback,
  type Feedback,
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
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
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
  const [response, setResponse] = useState("");
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
  const applyFeedbackUpdate = (data: Feedback[]) => {
    setFeedbacks(data);
    if (typeof window === "undefined") return;
    if (!currentAdmin?.unit) return;
    const key = `adminFeedbacksCache:${currentAdmin.unit}`;
    sessionStorage.setItem(key, JSON.stringify(data));
  };

  async function loadFeedbacks(unit: string) {
    if (!unit.trim()) {
      return;
    }

    try {
      const data = await listFeedbacks({ category: unit });
      applyFeedbackUpdate(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load feedbacks.",
      );
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
  }, [currentAdmin?.unit]);

  useEffect(() => {
    if (!currentAdmin?.unit) return;

    void listFeedbacks({ category: currentAdmin.unit })
      .then((data) => {
        startTransition(() => {
          applyFeedbackUpdate(data);
        });
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to load feedbacks.",
        );
      });
  }, [currentAdmin?.unit]);


  useEffect(() => {
    void listCategories()
      .then((data) => {
        setCategories(data.map((category) => category.name));
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to load categories.",
        );
      });
  }, []);

  const handleUpdateFeedback = async () => {
    if (!selectedFeedback) return;

    try {
      const payload: Partial<Feedback> & { responseAuthorEmail?: string } = {
        status: newStatus || selectedFeedback.status,
        priority: newPriority || selectedFeedback.priority,
      };
      if (response.trim() !== "") {
        payload.response = response.trim();
        if (currentAdmin?.email) {
          payload.responseAuthorEmail = currentAdmin.email;
        }
      }
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
      setResponse("");
      setNewStatus("");
      setNewPriority("");
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update feedback.",
      );
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

  const parseAdminResponses = (response?: string | null) => {
    if (!response) return [];
    return response
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^\[(.+?)\]\s*(.*)$/);
        if (!match) {
          return { time: null, author: null, message: line };
        }
        const rawMessage = match[2] || "";
        const parts = rawMessage.split(" — ");
        if (parts.length >= 2) {
          const author = parts.shift()?.trim() || null;
          const message = parts.join(" — ").trim();
          return { time: match[1], author, message };
        }
        return { time: match[1], author: null, message: rawMessage };
      })
      .filter((entry) => entry.message);
  };

  const formatAdminTime = (timeRaw?: string | null) => {
    if (!timeRaw) return null;
    const parsed = new Date(timeRaw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return timeRaw.replace(/\s*UTC\s*$/i, "");
  };

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

  const exportFeedbacksPdf = () => {
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

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("FeedForward - Feedback Report", 40, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${nowText}`, 40, 58);
    doc.text(`Filter: ${filterSummary}`, 40, 74);

    if (!rows.length) {
      doc.setTextColor(120);
      doc.text(
        "No feedback submissions match the current filters.",
        40,
        110,
      );
      doc.save(fileName);
      return;
    }

    const body: Array<
      Array<string> | Array<{ content: string; colSpan: number; styles?: any }>
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

    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = 70 + 70 + 80 + 70 + 110 + 220;
    const leftMargin = Math.max(40, (pageWidth - tableWidth) / 2);

    autoTable(doc, {
      startY: 100,
      head: [["ID", "Type", "Status", "Priority", "Submitted", "Subject"]],
      body,
      theme: "grid",
      margin: { left: leftMargin, right: leftMargin },
      styles: { fontSize: 9, cellPadding: 6, valign: "top" },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 70 },
        2: { cellWidth: 80 },
        3: { cellWidth: 70 },
        4: { cellWidth: 110 },
        5: { cellWidth: 220 },
      },
    });

    doc.save(fileName);
  };

  const exportFeedbacksXlsx = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Feedback");

    worksheet.columns = [
      { header: "ID", key: "id", width: 14 },
      { header: "Type", key: "type", width: 12 },
      { header: "Status", key: "status", width: 14 },
      { header: "Priority", key: "priority", width: 10 },
      { header: "Submitted", key: "submitted", width: 20 },
      { header: "Subject", key: "subject", width: 30 },
      { header: "Message", key: "message", width: 60 },
    ];

    worksheet.getRow(1).font = { bold: true };

    filteredFeedbacks.forEach((feedback) => {
      worksheet.addRow({
        id: feedback.id,
        type: feedback.type,
        status: feedback.status,
        priority: feedback.priority,
        submitted: formatSubmittedAt(feedback.createdAt),
        subject: feedback.subject,
        message: feedback.message,
      });
    });

    worksheet.columns.forEach((column) => {
      column.alignment = { vertical: "top", wrapText: true };
    });

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
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedFeedback(feedback);
                                  setResponse("");
                                  setNewStatus(feedback.status);
                                  setNewPriority(feedback.priority);
                                  setIsEditDialogOpen(true);
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
                                    className="space-y-4"
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
                                    className="space-y-4"
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
                                    <div className="space-y-2">
                                      <Label htmlFor="response">
                                        Add/Update Response
                                      </Label>
                                      <Textarea
                                        id="response"
                                        placeholder="Enter your response to the user..."
                                        rows={5}
                                        value={response}
                                        onChange={(e) =>
                                          setResponse(e.target.value)
                                        }
                                      />
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
