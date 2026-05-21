"use client";
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  createFeedback,
  createFeedbackMessage,
  deleteFeedback,
  getFeedback,
  listCategories,
  listFeedbackMessages,
  listFeedbacks,
  type Feedback,
  type FeedbackMessage,
} from "@/lib/api";
import { getPlaceholderRowCount } from "@/lib/tableUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { parseAdminResponses } from "@/lib/responseLog";
import { formatLocalTime } from "@/lib/time";
import { useDraftStorage } from "@/lib/useDraftStorage";
import { toastApiError } from "@/lib/errorHandling";
import { formatFilterChipLabel } from "@/lib/filterUtils";
import { formatFeedbackText } from "@/lib/textFormat";
import { FeedbackDetailsCard } from "@/components/feedback/FeedbackDetailsCard";
import { FeedbackStatusCard } from "@/components/feedback/FeedbackStatusCard";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer";

import {
  Send,
  Clock,
  CheckCircle,
  Circle,
  Wrench,
  MessageCircle,
  BarChart3,
  Plus,
  Search,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";

// Import constants and types
import {
  CREATE_SUBMISSION_STEP_ORDER,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_SUBJECT_MAX_LENGTH,
  CONVERSATION_MESSAGE_MAX_LENGTH,
  USER_MESSAGE_BUBBLE_CLASS,
  MY_SUBMISSIONS_PAGE_SIZE_OPTIONS,
  SUBMISSION_FILTER_CONTROL_CLASS,
  SUBMISSION_FILTER_TEXT_COLOR,
  USER_FEEDBACK_DRAFT_KEY,
  USER_DASHBOARD_SUBMISSIONS_SCROLL_KEY,
  EMPTY_FORM,
  SUBMISSION_FIELD_CLASS,
  SUBMISSION_ACTION_BUTTON_HEIGHT_CLASS,
  type UserDashboardView,
  type CreateSubmissionStep,
  type HoverFilterKey,
} from "./constants";

// Import dialog and view components
import {
  TrackingIdSuccess,
  CreateSubmissionDialog,
  ConfirmationDialog,
  DeleteConfirmationDialog,
  UnsentMessageWarning,
} from "./UserDashboard.Dialogs";
import { UserDashboardSubmitView } from "./UserDashboard.SubmitView";
import { UserDashboardMySubmissionsView } from "./UserDashboard.MySubmissionsView";
import { UserDashboardHomeView } from "./UserDashboard.HomeView";
import {
  HoverFilterPopover,
  type HoverFilterItem,
} from "@/components/filters/HoverFilterPopover";

export function UserDashboard({ view }: { view: UserDashboardView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const draftKey = USER_FEEDBACK_DRAFT_KEY;
  const emptyForm = EMPTY_FORM;
  const submissionsScrollKey = USER_DASHBOARD_SUBMISSIONS_SCROLL_KEY;
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    fullName: string;
    name: string;
    email: string;
    school: string;
    department: string;
  } | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [isCreateSubmissionOpen, setIsCreateSubmissionOpen] = useState(false);
  const [createSubmissionStep, setCreateSubmissionStep] =
    useState<CreateSubmissionStep>("form");
  const [createSubmissionStepDirection, setCreateSubmissionStepDirection] =
    useState<"forward" | "backward">("forward");
  const [createSubmissionTrackingId, setCreateSubmissionTrackingId] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterDate, setFilterDate] = useState("recent");
  const [filterTracking, setFilterTracking] = useState("asc");
  const [mySubmissionsPage, setMySubmissionsPage] = useState(1);
  const [mySubmissionsPageSize, setMySubmissionsPageSizeRaw] = useState<
    (typeof MY_SUBMISSIONS_PAGE_SIZE_OPTIONS)[number]
  >(() => {
    if (typeof window === "undefined") return 10;
    try {
      const stored = window.sessionStorage.getItem("mySubmissions_pageSize");
      const parsed = Number(stored);
      if (
        stored !== null &&
        (MY_SUBMISSIONS_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
      ) {
        return parsed as (typeof MY_SUBMISSIONS_PAGE_SIZE_OPTIONS)[number];
      }
    } catch {}
    return 10;
  });
  const setMySubmissionsPageSize = useCallback(
    (size: (typeof MY_SUBMISSIONS_PAGE_SIZE_OPTIONS)[number]) => {
      setMySubmissionsPageSizeRaw(size);
      try {
        window.sessionStorage.setItem("mySubmissions_pageSize", String(size));
      } catch {}
    },
    [],
  );
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null,
  );
  const [isAnonymous, setIsAnonymous] = useState(false);
  const {
    value: formData,
    setValue: setFormData,
    clear: clearDraft,
  } = useDraftStorage(draftKey, emptyForm);
  const [confirmData, setConfirmData] = useState(emptyForm);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Feedback | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isMiniChatOpen, setIsMiniChatOpen] = useState(false);
  const [isUnsentMessageDialogOpen, setIsUnsentMessageDialogOpen] =
    useState(false);
  const [leftColumnHeight, setLeftColumnHeight] = useState<number | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const submissionsScrollRef = useRef<HTMLDivElement>(null);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const miniConversationScrollRef = useRef<HTMLDivElement>(null);
  const createSubmissionDialogContentRef = useRef<HTMLDivElement>(null);
  const submissionsScrollTop = useRef(0);
  const feedbackSubmitLockRef = useRef(false);
  const [createSubmissionFormModalHeight, setCreateSubmissionFormModalHeight] =
    useState<number | null>(null);
  const isHomeView = view === "home";
  const isMySubmissionsView = view === "my-submissions";
  const isSubmitView = view === "submit-feedback";

  async function loadUserFeedbacks(userId: string) {
    try {
      const userFeedbacks = await listFeedbacks({ userId });
      setFeedbacks(userFeedbacks);
    } catch (error) {
      toastApiError(error, "Failed to load feedbacks.");
    }
  }

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const goToCreateSubmissionStep = useCallback(
    (nextStep: CreateSubmissionStep) => {
      const currentOrder = CREATE_SUBMISSION_STEP_ORDER[createSubmissionStep];
      const nextOrder = CREATE_SUBMISSION_STEP_ORDER[nextStep];
      setCreateSubmissionStepDirection(
        nextOrder >= currentOrder ? "forward" : "backward",
      );
      setCreateSubmissionStep(nextStep);
    },
    [createSubmissionStep],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isLoggedIn = localStorage.getItem("isUserLoggedIn");
    const userId = localStorage.getItem("currentUserId");

    if (!isLoggedIn || !userId) {
      router.push("/login");
      return;
    }

    setCurrentUser({
      id: userId,
      fullName: localStorage.getItem("currentUserName") || "",
      name: localStorage.getItem("currentUserName") || "",
      email: localStorage.getItem("currentUserEmail") || "",
      school: localStorage.getItem("currentUserSchool") || "",
      department: localStorage.getItem("currentUserDepartment") || "",
    });
  }, [router]);

  useLayoutEffect(() => {
    if (!isCreateSubmissionOpen || createSubmissionStep !== "form") return;
    if (
      typeof window === "undefined" ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }

    const node = createSubmissionDialogContentRef.current;
    if (!node) return;

    const syncHeight = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      if (height > 0) {
        setCreateSubmissionFormModalHeight(height);
      }
    };

    syncHeight();
    const observer = new ResizeObserver(() => {
      syncHeight();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [isCreateSubmissionOpen, createSubmissionStep]);

  // Draft storage handled by useDraftStorage.

  useEffect(() => {
    if (!currentUser?.id) return;

    void listFeedbacks({ userId: currentUser.id })
      .then((userFeedbacks) => {
        startTransition(() => {
          setFeedbacks(userFeedbacks);
        });
      })
      .catch((error) => {
        toastApiError(error, "Failed to load feedbacks.");
      });
  }, [currentUser?.id]);

  useEffect(() => {
    void listCategories()
      .then((data) => {
        setCategories(
          data
            .map((category) => category.name)
            .filter((name) => {
              const normalized = name.toLowerCase();
              return normalized !== "disabled" && normalized !== "inactive";
            }),
        );
      })
      .catch((error) => {
        toastApiError(error, "Failed to load categories.");
      });
  }, []);

  useEffect(() => {
    if (!selectedFeedback) {
      setMessages([]);
      setMessageDraft("");
      setIsMiniChatOpen(false);
      return;
    }

    setIsMessagesLoading(true);
    listFeedbackMessages(selectedFeedback.id)
      .then((data) => {
        if (data.length > 0) {
          setMessages(data);
          return;
        }
        if (selectedFeedback.response) {
          const legacy = parseAdminResponses(selectedFeedback.response).map(
            (entry, index) => ({
              id: `legacy-${selectedFeedback.id}-${index}`,
              feedbackId: selectedFeedback.id,
              senderRole: "admin" as const,
              senderId: null,
              senderName: entry.author || "Admin",
              message: entry.message,
              createdAt: entry.time
                ? new Date(entry.time).toISOString()
                : selectedFeedback.updatedAt,
            }),
          );
          setMessages(legacy);
          return;
        }
        setMessages([]);
      })
      .catch(() => {
        if (selectedFeedback.response) {
          const legacy = parseAdminResponses(selectedFeedback.response).map(
            (entry, index) => ({
              id: `legacy-${selectedFeedback.id}-${index}`,
              feedbackId: selectedFeedback.id,
              senderRole: "admin" as const,
              senderId: null,
              senderName: entry.author || "Admin",
              message: entry.message,
              createdAt: entry.time
                ? new Date(entry.time).toISOString()
                : selectedFeedback.updatedAt,
            }),
          );
          setMessages(legacy);
          return;
        }
        setMessages([]);
      })
      .finally(() => {
        setIsMessagesLoading(false);
      });
  }, [selectedFeedback]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsLargeScreen(mediaQuery.matches);
    handleChange();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!isLargeScreen) {
      setLeftColumnHeight(null);
      return;
    }
    const node = leftColumnRef.current;
    if (!node) return;

    const updateHeight = () => {
      setLeftColumnHeight(Math.round(node.getBoundingClientRect().height));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);

    return () => observer.disconnect();
  }, [isLargeScreen]);

  const restoreSubmissionsScroll = useCallback(
    (force = false) => {
      if (!force && (selectedFeedback || trackingId)) return;
      const node = submissionsScrollRef.current;
      if (!node) return;
      const top = submissionsScrollTop.current;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.scrollTop = top;
        });
      });
    },
    [selectedFeedback, trackingId],
  );

  const scrollConversationsToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      [
        conversationScrollRef.current,
        miniConversationScrollRef.current,
      ].forEach((container) => {
        if (!container) return;
        window.requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior,
          });
        });
      });
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(submissionsScrollKey);
    if (stored) {
      const value = Number.parseInt(stored, 10);
      submissionsScrollTop.current = Number.isNaN(value) ? 0 : value;
    }
  }, [submissionsScrollKey]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedFeedback || trackingId) return;
    const stored = window.sessionStorage.getItem(submissionsScrollKey);
    if (stored) {
      const value = Number.parseInt(stored, 10);
      submissionsScrollTop.current = Number.isNaN(value) ? 0 : value;
    }
    restoreSubmissionsScroll();
  }, [
    feedbacks.length,
    selectedFeedback,
    trackingId,
    leftColumnHeight,
    restoreSubmissionsScroll,
  ]);

  const handleLogout = () => {
    localStorage.removeItem("isUserLoggedIn");
    localStorage.removeItem("currentUserId");
    localStorage.removeItem("currentUserName");
    localStorage.removeItem("currentUserEmail");
    localStorage.removeItem("currentUserSchool");
    localStorage.removeItem("currentUserDepartment");
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const copyToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      toast.success("Tracking ID copied!");
    } catch {
      toast.error("Failed to copy. Please copy manually.");
    }
    document.body.removeChild(textArea);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (formData.message.trim().length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      toast.error(
        `Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or less.`,
      );
      return;
    }

    setConfirmData({
      ...formData,
      category: formData.category.trim(),
    });
    setIsConfirmOpen(true);
  };

  const handleCreateSubmissionFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (formData.message.trim().length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      toast.error(
        `Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or less.`,
      );
      return;
    }

    setConfirmData({
      ...formData,
      category: formData.category.trim(),
    });
    const currentModalHeight = Math.ceil(
      createSubmissionDialogContentRef.current?.getBoundingClientRect()
        .height ?? 0,
    );
    if (currentModalHeight > 0) {
      setCreateSubmissionFormModalHeight(currentModalHeight);
    }
    goToCreateSubmissionStep("confirm");
  };

  const handleCreateSubmissionConfirmSubmit = async () => {
    if (!currentUser) return;
    if (feedbackSubmitLockRef.current) return;
    if (confirmData.message.trim().length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      toast.error(
        `Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or less.`,
      );
      return;
    }
    feedbackSubmitLockRef.current = true;
    setIsSubmittingFeedback(true);
    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;
    const normalizedSubject = formatFeedbackText(confirmData.subject);
    const normalizedMessage = formatFeedbackText(confirmData.message);
    try {
      await createFeedback({
        id: newTrackingId,
        type: confirmData.type,
        category: confirmData.category.trim(),
        subject: normalizedSubject,
        message: normalizedMessage,
        status: "Pending",
        priority: "Medium",
        isAnonymous,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userEmail: currentUser.email,
        response: "",
      });

      await loadUserFeedbacks(currentUser.id);
      toast.success("Feedback submitted successfully!");
      setCreateSubmissionTrackingId(newTrackingId);
      goToCreateSubmissionStep("success");
      setFormData(emptyForm);
      clearDraft();
      setConfirmData(emptyForm);
      setIsAnonymous(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit feedback.";
      if (message.toLowerCase().includes("log in again")) {
        handleLogout();
        return;
      }
      toast.error(message);
    } finally {
      feedbackSubmitLockRef.current = false;
      setIsSubmittingFeedback(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!currentUser) return;
    if (feedbackSubmitLockRef.current) return;
    if (confirmData.message.trim().length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      toast.error(
        `Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or less.`,
      );
      return;
    }
    feedbackSubmitLockRef.current = true;
    setIsSubmittingFeedback(true);
    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;
    const normalizedSubject = formatFeedbackText(confirmData.subject);
    const normalizedMessage = formatFeedbackText(confirmData.message);
    try {
      await createFeedback({
        id: newTrackingId,
        type: confirmData.type,
        category: confirmData.category.trim(),
        subject: normalizedSubject,
        message: normalizedMessage,
        status: "Pending",
        priority: "Medium",
        isAnonymous,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userEmail: currentUser.email,
        response: "",
      });

      setTrackingId(newTrackingId);
      await loadUserFeedbacks(currentUser.id);
      toast.success("Feedback submitted successfully!");
      setFormData(emptyForm);
      clearDraft();
      setConfirmData(emptyForm);
      setIsAnonymous(false);
      setIsConfirmOpen(false);
      setIsCreateSubmissionOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit feedback.";
      if (message.toLowerCase().includes("log in again")) {
        handleLogout();
        return;
      }
      toast.error(message);
    } finally {
      feedbackSubmitLockRef.current = false;
      setIsSubmittingFeedback(false);
    }
  };

  const handleViewFeedback = async (feedback: Feedback) => {
    try {
      const latest = await getFeedback(feedback.id);
      setSelectedFeedback(latest);
    } catch {
      setSelectedFeedback(feedback);
    }
  };

  const handleDeleteFeedback = async (feedback: Feedback) => {
    if (!currentUser) return;
    if (feedback.status.toLowerCase() !== "pending") {
      toast.error("Only pending submissions can be deleted.");
      return;
    }
    try {
      await deleteFeedback(feedback.id);
      await loadUserFeedbacks(currentUser.id);
      if (selectedFeedback?.id === feedback.id) {
        setSelectedFeedback(null);
      }
      toast.success("Submission deleted.");
    } catch (error) {
      toastApiError(error, "Failed to delete submission.");
    }
  };

  const handleSendMessage = async () => {
    if (!selectedFeedback) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) {
      toast.error("Please enter a message.");
      return;
    }
    if (trimmed.length > CONVERSATION_MESSAGE_MAX_LENGTH) {
      toast.error(
        `Message must be ${CONVERSATION_MESSAGE_MAX_LENGTH} characters or less.`,
      );
      return;
    }
    const normalizedMessage = formatFeedbackText(trimmed);
    setIsSendingMessage(true);
    try {
      const created = await createFeedbackMessage(selectedFeedback.id, {
        message: normalizedMessage,
      });
      setMessages((prev) => [...prev, created]);
      setMessageDraft("");
      scrollConversationsToBottom("smooth");
    } catch (error) {
      toastApiError(error, "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  useEffect(() => {
    if (!selectedFeedback) return;
    if (isMessagesLoading) return;
    scrollConversationsToBottom();
  }, [
    selectedFeedback,
    isMessagesLoading,
    messages.length,
    isMiniChatOpen,
    scrollConversationsToBottom,
  ]);

  const normalizeStatus = (status: string) =>
    status.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

  const getStatusBadgeClass = (status: string) => {
    switch (normalizeStatus(status)) {
      case "pending":
        return "border-amber-300/80 bg-amber-50 text-amber-800";
      case "in progress":
        return "border-blue-300/80 bg-blue-50 text-blue-800";
      case "resolved":
        return "border-emerald-300/80 bg-emerald-50 text-emerald-800";
      default:
        return "border-slate-300/80 bg-slate-50 text-slate-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (normalizeStatus(status)) {
      case "pending":
        return Clock;
      case "in progress":
        return Wrench;
      case "resolved":
        return CheckCircle;
      default:
        return Circle;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${datePart} · ${timePart}`;
  };

  const closeSelectedFeedback = useCallback(() => {
    setMessageDraft("");
    setSelectedFeedback(null);
  }, []);

  const closeMiniChat = useCallback(() => {
    setIsMiniChatOpen(false);
  }, []);

  const handleAttemptCloseSelectedFeedback = useCallback(() => {
    if (messageDraft.trim().length > 0) {
      setIsUnsentMessageDialogOpen(true);
      return;
    }
    closeSelectedFeedback();
  }, [closeSelectedFeedback, messageDraft]);

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

  const formatConfirmSubmittedOn = (value: string) => {
    const date = new Date(value);
    const datePart = date.toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
    });
    return `${datePart} · ${timePart}`;
  };

  const renderConfirmSummary = () => {
    const nowIso = new Date().toISOString();
    const previewSubject = confirmData.subject.trim() || "-";
    const previewMessage = confirmData.message.trim() || "-";
    const previewFeedback: Feedback = {
      id: "preview",
      type: confirmData.type || "-",
      category: confirmData.category || "-",
      priority: "Medium",
      status: "Pending",
      subject: previewSubject,
      message: previewMessage,
      userId: currentUser?.id ?? null,
      userName: currentUser?.fullName || currentUser?.name || "",
      userEmail: currentUser?.email || "",
      isAnonymous,
      createdAt: nowIso,
      updatedAt: nowIso,
      response: "",
    };

    return (
      <div>
        <FeedbackDetailsCard
          feedback={previewFeedback}
          title=""
          className="rounded-none border-0 bg-transparent shadow-none"
          messageVisibleLines={4}
          compactNoTitleLayout
          indentMessageFirstLineIfMultiline
          hidePriority
          hideDate
          showSubjectSeparators
          formatDate={formatConfirmSubmittedOn}
          preSubjectContent={
            <div className="grid grid-cols-1 gap-y-4">
              <div className="space-y-1">
                <Label className="text-black">Date</Label>
                <p className="pt-0.5 text-[0.98rem] font-normal break-words">
                  {formatConfirmSubmittedOn(previewFeedback.createdAt)}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-black">Submitted By</Label>
                <p className="pt-0.5 text-[0.98rem] font-normal break-words">
                  {isAnonymous
                    ? "*****"
                    : currentUser?.fullName || currentUser?.name || "*****"}
                </p>
              </div>
            </div>
          }
        />
      </div>
    );
  };

  const renderSubmissionForm = (
    idPrefix: string,
    onSubmit: (e: React.FormEvent) => void = handleSubmit,
  ) => (
    <form onSubmit={onSubmit} className="space-y-2 pt-2">
      <div className="grid gap-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-type`}>Feedback Type *</Label>
          {isHydrated ? (
            <Select
              value={formData.type}
              disabled={isSubmittingFeedback}
              onValueChange={(value) =>
                setFormData({ ...formData, type: value })
              }
              required
            >
              <SelectTrigger
                id={`${idPrefix}-type`}
                className={SUBMISSION_FIELD_CLASS}
              >
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="z-[110]">
                <SelectItem value="suggestion">Suggestion</SelectItem>
                <SelectItem value="complaint">Complaint</SelectItem>
                <SelectItem value="inquiry">Inquiry</SelectItem>
                <SelectItem value="request">Request</SelectItem>
                <SelectItem value="compliment">Compliment</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div
              className="h-10 rounded-lg border bg-muted/30"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-category`}>Category *</Label>
          {isHydrated ? (
            <Select
              value={formData.category}
              disabled={isSubmittingFeedback}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value })
              }
              required
            >
              <SelectTrigger
                id={`${idPrefix}-category`}
                className={SUBMISSION_FIELD_CLASS}
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="z-[110]">
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div
              className="h-10 rounded-lg border bg-muted/30"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-subject`}>Subject *</Label>
          <Input
            id={`${idPrefix}-subject`}
            placeholder="Brief summary of your feedback"
            className={SUBMISSION_FIELD_CLASS}
            value={formData.subject}
            maxLength={FEEDBACK_SUBJECT_MAX_LENGTH}
            disabled={isSubmittingFeedback}
            onChange={(e) =>
              setFormData({
                ...formData,
                subject: e.target.value.slice(0, FEEDBACK_SUBJECT_MAX_LENGTH),
              })
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-message`}>Message *</Label>
          <Textarea
            id={`${idPrefix}-message`}
            placeholder="Provide detailed information about your feedback..."
            rows={1}
            className="ff-hide-scrollbar w-full max-w-full min-h-[2.5rem] max-h-[4rem] rounded-lg border-border/70 bg-background overflow-y-auto focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-200/60 [field-sizing:content] [max-inline-size:100%] [overflow-wrap:anywhere] [word-break:break-word] [white-space:pre-wrap]"
            maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
            value={formData.message}
            disabled={isSubmittingFeedback}
            onChange={(e) =>
              setFormData({
                ...formData,
                message: e.target.value.slice(0, FEEDBACK_MESSAGE_MAX_LENGTH),
              })
            }
            required
          />
          <p className="text-right text-xs text-black">
            {formData.message.length}/{FEEDBACK_MESSAGE_MAX_LENGTH}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
        <Checkbox
          id={`${idPrefix}-anonymous`}
          disabled={isSubmittingFeedback}
          checked={isAnonymous}
          onCheckedChange={(checked) => setIsAnonymous(checked === true)}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <Label
            htmlFor={`${idPrefix}-anonymous`}
            className="cursor-pointer text-sm font-normal"
          >
            Submit anonymously
          </Label>
          <p className="text-sm text-black">
            When checked, your name will be hidden to the admins.
          </p>
        </div>
      </div>

      <Button
        type="submit"
        className={`${SUBMISSION_ACTION_BUTTON_HEIGHT_CLASS} w-full rounded-lg bg-accent hover:bg-accent/90`}
        disabled={isSubmittingFeedback}
      >
        <Send className="mr-2 h-4 w-4" />
        {isSubmittingFeedback ? "Submitting feedback..." : "Submit Feedback"}
      </Button>
      {isSubmittingFeedback ? (
        <p
          className="text-center text-xs text-black"
          aria-live="polite"
        >
          Feedback is being sent. Please wait...
        </p>
      ) : null}
    </form>
  );

  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredFeedbacks = useMemo(() => {
    const byFilter = feedbacks.filter((feedback) => {
      const matchesSearch =
        !trimmedSearchQuery ||
        feedback.id.toLowerCase().includes(trimmedSearchQuery) ||
        feedback.subject.toLowerCase().includes(trimmedSearchQuery) ||
        feedback.message.toLowerCase().includes(trimmedSearchQuery) ||
        feedback.category.toLowerCase().includes(trimmedSearchQuery);

      const matchesType =
        filterType.length === 0 ||
        filterType.some((t) => feedback.type.toLowerCase() === t);
      const matchesCategory =
        filterCategory === "all" ||
        feedback.category.toLowerCase() === filterCategory.toLowerCase();
      const matchesPriority =
        filterPriority.length === 0 ||
        filterPriority.some((p) => feedback.priority.toLowerCase() === p);
      const normalized = normalizeStatus(feedback.status);
      const matchesStatus =
        filterStatus.length === 0 ||
        filterStatus.some((s) =>
          normalized === (s === "inprogress" ? "in progress" : s),
        );

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesPriority &&
        matchesStatus
      );
    });

    return byFilter.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        pending: 0,
        "in progress": 1,
        resolved: 2,
      };
      const statusDiff =
        (statusOrder[normalizeStatus(a.status)] ?? 99) -
        (statusOrder[normalizeStatus(b.status)] ?? 99);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      const dateDiff =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (dateDiff !== 0) {
        return filterDate === "oldest" ? dateDiff : -dateDiff;
      }
      return filterTracking === "desc"
        ? b.id.localeCompare(a.id)
        : a.id.localeCompare(b.id);
    });
  }, [
    feedbacks,
    filterCategory,
    filterDate,
    filterPriority,
    filterStatus,
    filterTracking,
    filterType,
    trimmedSearchQuery,
  ]);

  const mySubmissionsTotalPages = Math.max(
    1,
    Math.ceil(filteredFeedbacks.length / mySubmissionsPageSize),
  );

  const paginatedFilteredFeedbacks = useMemo(() => {
    const startIndex = (mySubmissionsPage - 1) * mySubmissionsPageSize;
    return filteredFeedbacks.slice(
      startIndex,
      startIndex + mySubmissionsPageSize,
    );
  }, [filteredFeedbacks, mySubmissionsPage, mySubmissionsPageSize]);
  const mySubmissionsPlaceholderRowCount = getPlaceholderRowCount(
    mySubmissionsPage,
    mySubmissionsPageSize,
    10,
    paginatedFilteredFeedbacks.length,
  );

  useEffect(() => {
    setMySubmissionsPage(1);
  }, [
    searchQuery,
    filterTracking,
    filterDate,
    filterType,
    filterCategory,
    filterPriority,
    filterStatus,
    mySubmissionsPageSize,
  ]);

  useEffect(() => {
    if (mySubmissionsPage > mySubmissionsTotalPages) {
      setMySubmissionsPage(mySubmissionsTotalPages);
    }
  }, [mySubmissionsPage, mySubmissionsTotalPages]);

  const activeFilterCount = [
    filterTracking !== "asc",
    filterDate !== "recent",
    filterType.length > 0,
    filterCategory !== "all",
    filterPriority.length > 0,
    filterStatus.length > 0,
  ].filter(Boolean).length;
  const activeFilterChips = [
    trimmedSearchQuery ? { key: "search", label: searchQuery.trim() } : null,
    filterTracking !== "asc" ? { key: "tracking", label: "Z - A" } : null,
    filterDate !== "recent" ? { key: "date", label: "Oldest" } : null,
    ...filterType.map((t) => ({ key: `type:${t}`, label: formatFilterChipLabel(t) })),
    filterCategory !== "all"
      ? { key: "category", label: formatFilterChipLabel(filterCategory) }
      : null,
    ...filterPriority.map((p) => ({ key: `priority:${p}`, label: formatFilterChipLabel(p) })),
    ...filterStatus.map((s) => ({
      key: `status:${s}`,
      label: s === "inprogress" ? "In Progress" : formatFilterChipLabel(s),
    })),
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  const clearSingleFilter = useCallback((key: string) => {
    switch (key) {
      case "search":
        setSearchQuery("");
        break;
      case "tracking":
        setFilterTracking("asc");
        break;
      case "date":
        setFilterDate("recent");
        break;
      case "category":
        setFilterCategory("all");
        break;
      default:
        if (key.startsWith("type:")) {
          const val = key.slice(5);
          setFilterType((prev) => prev.filter((t) => t !== val));
        } else if (key.startsWith("priority:")) {
          const val = key.slice(9);
          setFilterPriority((prev) => prev.filter((p) => p !== val));
        } else if (key.startsWith("status:")) {
          const val = key.slice(7);
          setFilterStatus((prev) => prev.filter((s) => s !== val));
        }
        break;
    }
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setFilterTracking("asc");
    setFilterDate("recent");
    setFilterType([]);
    setFilterCategory("all");
    setFilterPriority([]);
    setFilterStatus([]);
  }, []);

  useEffect(() => {
    if (isMySubmissionsView) return;
    clearAllFilters();
    setMySubmissionsPage(1);
  }, [clearAllFilters, isMySubmissionsView]);

  useEffect(() => {
    try {
      window.sessionStorage.removeItem("mySubmissions_filters");
    } catch {}

    const filterKeys = ["q", "tr", "dt", "ty", "cat", "pri", "st"];
    const params = new URLSearchParams(window.location.search);
    const hadFilterParams = filterKeys.some((key) => params.has(key));
    if (hadFilterParams) {
      filterKeys.forEach((key) => params.delete(key));
      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }

    return () => {
      try {
        window.sessionStorage.removeItem("mySubmissions_filters");
      } catch {}
    };
  }, [pathname, router]);
  const hoverFilterItems = useMemo(
    () =>
      [
        {
          key: "tracking" as const,
          label: filterTracking === "desc" ? "Z - A" : "A - Z",
          options: [
            { value: "asc", label: "A - Z" },
            { value: "desc", label: "Z - A" },
          ],
          isSelected: (value: string) => filterTracking === value,
          onSelect: setFilterTracking,
        },
        {
          key: "date" as const,
          label: filterDate === "oldest" ? "Oldest" : "Most Recent",
          options: [
            { value: "recent", label: "Most Recent" },
            { value: "oldest", label: "Oldest" },
          ],
          isSelected: (value: string) => filterDate === value,
          onSelect: setFilterDate,
        },
        {
          key: "type" as const,
          label:
            filterType.length === 0
              ? "All Types"
              : formatFilterChipLabel(filterType[filterType.length - 1]!),
          options: [
            { value: "suggestion", label: "Suggestion" },
            { value: "complaint", label: "Complaint" },
            { value: "inquiry", label: "Inquiry" },
            { value: "request", label: "Request" },
            { value: "compliment", label: "Compliment" },
          ],
          isSelected: (value: string) => filterType.includes(value),
          onSelect: (value: string) =>
            setFilterType((prev) =>
              prev.includes(value)
                ? prev.filter((t) => t !== value)
                : [...prev, value],
            ),
        },
        {
          key: "category" as const,
          label:
            filterCategory === "all"
              ? "All Categories"
              : formatFilterChipLabel(filterCategory),
          options: [
            { value: "all", label: "All Categories" },
            ...categories.map((category) => ({
              value: category.toLowerCase(),
              label: category,
            })),
          ],
          isSelected: (value: string) => filterCategory === value,
          onSelect: setFilterCategory,
        },
        {
          key: "priority" as const,
          label:
            filterPriority.length === 0
              ? "All Priorities"
              : formatFilterChipLabel(filterPriority[filterPriority.length - 1]!),
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ],
          isSelected: (value: string) => filterPriority.includes(value),
          onSelect: (value: string) =>
            setFilterPriority((prev) =>
              prev.includes(value)
                ? prev.filter((p) => p !== value)
                : [...prev, value],
            ),
        },
        {
          key: "status" as const,
          label:
            filterStatus.length === 0
              ? "All Status"
              : filterStatus[filterStatus.length - 1] === "inprogress"
                ? "In Progress"
                : formatFilterChipLabel(filterStatus[filterStatus.length - 1]!),
          options: [
            { value: "pending", label: "Pending" },
            { value: "inprogress", label: "In Progress" },
            { value: "resolved", label: "Resolved" },
          ],
          isSelected: (value: string) => filterStatus.includes(value),
          onSelect: (value: string) =>
            setFilterStatus((prev) =>
              prev.includes(value)
                ? prev.filter((s) => s !== value)
                : [...prev, value],
            ),
        },
      ] satisfies HoverFilterItem<HoverFilterKey>[],
    [
      categories,
      filterCategory,
      filterDate,
      filterPriority,
      filterStatus,
      filterTracking,
      filterType,
    ],
  );
  const desktopInlineFilterItems = useMemo(
    () =>
      hoverFilterItems.filter((item) =>
        ["tracking", "date"].includes(item.key),
      ),
    [hoverFilterItems],
  );
  const dashboardStats = useMemo(() => {
    const pending = feedbacks.filter(
      (item) => normalizeStatus(item.status) === "pending",
    ).length;
    const inProgress = feedbacks.filter(
      (item) => normalizeStatus(item.status) === "in progress",
    ).length;
    const resolved = feedbacks.filter(
      (item) => normalizeStatus(item.status) === "resolved",
    ).length;
    return {
      total: feedbacks.length,
      pending,
      inProgress,
      resolved,
    };
  }, [feedbacks]);
  const latestSubmissionCards = useMemo(
    () =>
      [...feedbacks].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [feedbacks],
  );

  const needsAttentionCards = useMemo(
    () =>
      [...feedbacks]
        .filter((item) => {
          const normalized = normalizeStatus(item.status);
          return normalized === "pending" || normalized === "in progress";
        })
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [feedbacks],
  );

  const recentlyUpdatedCards = useMemo(
    () =>
      [...feedbacks].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [feedbacks],
  );

  const homeNotifications = useMemo(
    () =>
      [...feedbacks]
        .filter((item) => normalizeStatus(item.status) !== "resolved")
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 5),
    [feedbacks],
  );

  const notificationPanelMaxHeight = useMemo(() => {
    const notificationCount = homeNotifications.length;
    const viewportCap = isLargeScreen ? 387 : 520;
    const contentAwareHeight =
      notificationCount === 0 ? 180 : 136 + notificationCount * 76;

    return Math.min(viewportCap, contentAwareHeight);
  }, [homeNotifications.length, isLargeScreen]);

  const renderHomeSubmissionGrid = (
    items: Feedback[],
    emptyMessage: string,
  ) => {
    const visibleItems = items.slice(0, 6);
    if (items.length === 0) {
      return (
        <Card className="border shadow-sm">
          <CardContent className="py-10 text-center text-sm text-black">
            {emptyMessage}
          </CardContent>
        </Card>
      );
    }

    return (
      <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((feedback) => (
            <button
              key={feedback.id}
              type="button"
              onClick={() => handleViewFeedback(feedback)}
              className="w-full text-left"
            >
              <Card className="h-full border shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className="min-h-[1.25rem] break-all text-xs"
                      style={{ color: "#666666" }}
                    >
                      {feedback.id}
                    </p>
                    <span
                      className="whitespace-nowrap text-[11px]"
                      style={{ color: "#666666" }}
                    >
                      {new Date(feedback.createdAt).toLocaleDateString("en-US")}
                    </span>
                  </div>
                  <p className="line-clamp-2 min-h-[3rem] break-words font-medium leading-snug text-[#b72860]">
                    {feedback.subject}
                  </p>
                  <p
                    className={`line-clamp-2 min-h-[2.5rem] text-sm text-red-600 ${
                      feedback.message.trim().length > 70 &&
                      /\s/.test(feedback.message.trim())
                        ? "indent-5"
                        : ""
                    }`}
                    style={{ color: "#6e6e6e" }}
                  >
                    {feedback.message}
                  </p>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="rounded-md border border-[#d7dbe2] bg-[#f8fafc] px-2 py-0.5 text-xs text-black">
                      {feedback.category}
                    </span>
                    <span className="inline-flex items-center">
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
                            {feedback.status}
                          </Badge>
                        );
                      })()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-xs text-black">
          <p>
            {items.length > visibleItems.length
              ? `Showing ${visibleItems.length} of ${items.length} items`
              : `Showing all ${visibleItems.length} item${visibleItems.length === 1 ? "" : "s"}`}
          </p>
          {items.length > visibleItems.length ? (
            <button
              type="button"
              className="font-normal text-accent hover:underline"
              onClick={() => router.push("/user/my-submissions")}
            >
              View all
            </button>
          ) : null}
        </div>
      </>
    );
  };

  const handleTrackSubmission = async (id: string) => {
    setIsCreateSubmissionOpen(false);
    setCreateSubmissionStep("form");
    setCreateSubmissionStepDirection("forward");
    setCreateSubmissionTrackingId(null);
    const existingFeedback = feedbacks.find((fb) => fb.id === id);
    if (existingFeedback) {
      await handleViewFeedback(existingFeedback);
      return;
    }
    try {
      const latest = await getFeedback(id);
      setSelectedFeedback(latest);
    } catch {
      toast.error("Unable to open submission details right now.");
    }
  };

  const renderCreateSubmissionDialog = () => (
    <CreateSubmissionDialog
      isOpen={isCreateSubmissionOpen}
      currentStep={createSubmissionStep}
      stepDirection={createSubmissionStepDirection}
      isSubmitting={isSubmittingFeedback}
      trackingIdForSuccess={createSubmissionTrackingId}
      currentUserEmail={currentUser?.email}
      modalHeight={createSubmissionFormModalHeight}
      contentRef={createSubmissionDialogContentRef}
      onOpenChange={(open) => {
        setIsCreateSubmissionOpen(open);
        if (!open) {
          setCreateSubmissionStep("form");
          setCreateSubmissionStepDirection("forward");
          setCreateSubmissionTrackingId(null);
          setCreateSubmissionFormModalHeight(null);
        }
      }}
      onStepChange={goToCreateSubmissionStep}
      renderSubmissionForm={renderSubmissionForm}
      onFormSubmit={handleCreateSubmissionFormSubmit}
      renderConfirmSummary={renderConfirmSummary}
      onConfirmSubmit={handleCreateSubmissionConfirmSubmit}
      onCopyTrackingId={copyToClipboard}
      onTrackSubmission={async (id) => {
        setIsCreateSubmissionOpen(false);
        setCreateSubmissionStep("form");
        setCreateSubmissionStepDirection("forward");
        setCreateSubmissionTrackingId(null);

        const existingFeedback = feedbacks.find((fb) => fb.id === id);
        if (existingFeedback) {
          await handleViewFeedback(existingFeedback);
          return;
        }
        try {
          const latest = await getFeedback(id);
          setSelectedFeedback(latest);
        } catch {
          toast.error("Unable to open submission details right now.");
        }
      }}
      onSubmitAnother={() => {
        goToCreateSubmissionStep("form");
        setCreateSubmissionTrackingId(null);
      }}
    />
  );

  return (
    <>
      <div className="ff-user-dashboard-theme min-h-[calc(100vh-200px)] bg-muted/20">
        {/* Tracking ID Success Modal */}
        <TrackingIdSuccess
          trackingId={trackingId}
          currentUserEmail={currentUser?.email}
          onClose={() => {
            setTrackingId(null);
            setSelectedFeedback(null);
            setTimeout(() => {
              restoreSubmissionsScroll(true);
            }, 200);
          }}
          onCopyTrackingId={copyToClipboard}
        />

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          onConfirm={handleConfirmSubmit}
          isLoading={isSubmittingFeedback}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={isDeleteOpen}
          deleteTarget={deleteTarget}
          onOpenChange={(open) => {
            setIsDeleteOpen(open);
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          onDelete={handleDeleteFeedback}
        />

        <div
          className={`mx-auto w-full px-4 ${
            isHomeView || isMySubmissionsView
              ? "pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5"
              : "py-6 sm:px-6 sm:py-8"
          } ${isMySubmissionsView || isHomeView ? "max-w-none" : "max-w-5xl"}`}
        >
          <div className="grid gap-6 sm:gap-8 items-stretch">
            {isSubmitView && (
              <UserDashboardSubmitView
                leftColumnRef={leftColumnRef}
                renderSubmissionForm={renderSubmissionForm}
              />
            )}

            {(isMySubmissionsView || isHomeView) && (
              <div
                className={`flex flex-col ${
                  isMySubmissionsView ? "min-h-0 h-full overflow-visible" : ""
                }`}
                style={
                  isMySubmissionsView && leftColumnHeight
                    ? { height: leftColumnHeight }
                    : undefined
                }
              >
                <div
                  className={
                    selectedFeedback
                      ? "blur-[2px] pointer-events-none select-none"
                      : ""
                  }
                >
                  {isHomeView ? (
                    <UserDashboardHomeView
                      dashboardStats={dashboardStats}
                      latestSubmissionCards={latestSubmissionCards}
                      needsAttentionCards={needsAttentionCards}
                      recentlyUpdatedCards={recentlyUpdatedCards}
                      homeNotifications={homeNotifications}
                      notificationPanelMaxHeight={notificationPanelMaxHeight}
                      onViewFeedback={handleViewFeedback}
                      onCreateSubmission={() => setIsCreateSubmissionOpen(true)}
                      renderCreateSubmissionDialog={renderCreateSubmissionDialog}
                      renderHomeSubmissionGrid={renderHomeSubmissionGrid}
                      getStatusBadgeClass={getStatusBadgeClass}
                      getStatusIcon={getStatusIcon}
                    />
                  ) : isMySubmissionsView ? (
                    <UserDashboardMySubmissionsView
                      feedbacks={feedbacks}
                      filteredFeedbacks={filteredFeedbacks}
                      paginatedFilteredFeedbacks={paginatedFilteredFeedbacks}
                      searchQuery={searchQuery}
                      filterType={filterType}
                      filterPriority={filterPriority}
                      filterStatus={filterStatus}
                      filterTracking={filterTracking}
                      filterDate={filterDate}
                      mySubmissionsPage={mySubmissionsPage}
                      mySubmissionsPageSize={mySubmissionsPageSize}
                      mySubmissionsTotalPages={mySubmissionsTotalPages}
                      submissionsScrollRef={submissionsScrollRef}
                      submissionsScrollKey={submissionsScrollKey}
                      submissionsScrollTop={submissionsScrollTop}
                      mySubmissionsPlaceholderRowCount={mySubmissionsPlaceholderRowCount}
                      activeFilterChips={activeFilterChips}
                      activeFilterCount={activeFilterCount}
                      hoverFilterItems={hoverFilterItems}
                      desktopInlineFilterItems={desktopInlineFilterItems}
                      onSearchChange={setSearchQuery}
                      onFilterTypeChange={setFilterType}
                      onFilterPriorityChange={setFilterPriority}
                      onFilterStatusChange={setFilterStatus}
                      onFilterTrackingChange={setFilterTracking}
                      onFilterDateChange={setFilterDate}
                      onViewFeedback={handleViewFeedback}
                      onCreateSubmissionClick={() => {
                        setCreateSubmissionStep("form");
                        setCreateSubmissionTrackingId(null);
                        setIsAnonymous(false);
                        setIsCreateSubmissionOpen(true);
                      }}
                      onDeleteClick={(feedback) => {
                        setDeleteTarget(feedback);
                        setIsDeleteOpen(true);
                      }}
                      onClearSingleFilter={clearSingleFilter}
                      onClearAllFilters={clearAllFilters}
                      onPageChange={setMySubmissionsPage}
                      onPageSizeChange={setMySubmissionsPageSize}
                      renderCreateSubmissionDialog={renderCreateSubmissionDialog}
                      getPriorityColor={getPriorityColor}
                      getStatusBadgeClass={getStatusBadgeClass}
                      getStatusIcon={getStatusIcon}
                      formatSubmittedAt={formatSubmittedAt}
                    />
                  ) : null}
                </div>
                {selectedFeedback ? (
                  <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <button
                      type="button"
                      aria-label="Close feedback details"
                      className="ff-modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                      onClick={handleAttemptCloseSelectedFeedback}
                    />
                    {/* Unsent message overlay — outside Card so overflow-hidden doesn't clip it */}
                    {isUnsentMessageDialogOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-[1px]"
                          onClick={() => { setIsUnsentMessageDialogOpen(false); closeSelectedFeedback(); }}
                        />
                        <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
                          <div className="pointer-events-auto w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
                            <div className="space-y-2 text-left">
                              <h2 className="text-lg font-normal">Discard unsent message?</h2>
                              <p className="text-sm text-black">You have a message that has not been sent yet.</p>
                            </div>
                            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                              <Button type="button" variant="outline" onClick={() => setIsUnsentMessageDialogOpen(false)}>Keep</Button>
                              <Button type="button" onClick={() => { setIsUnsentMessageDialogOpen(false); closeSelectedFeedback(); }}>Discard</Button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    <Card className="ff-modal-panel relative z-10 w-full max-w-4xl h-[83vh] min-h-0 flex flex-col overflow-hidden shadow-2xl">

                      <CardHeader className="space-y-0 pb-0">
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle>Feedback Details</CardTitle>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            aria-label="Close feedback details"
                            onClick={handleAttemptCloseSelectedFeedback}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <CardDescription
                          className="text-black"
                          style={{ color: "#666666" }}
                        >
                          {selectedFeedback.id}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="ff-hide-scrollbar flex-1 min-h-0 overflow-y-auto space-y-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <div className="w-full">
                          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                            <FeedbackStatusCard
                              feedback={selectedFeedback}
                              formatDate={formatDate}
                              className="h-[27.5rem]"
                            />

                            <div>
                              <FeedbackDetailsCard
                                feedback={selectedFeedback}
                                title="Feedback Details"
                                formatDate={formatDate}
                                className="h-[27.5rem]"
                              />
                            </div>
                          </div>
                        </div>

                      </CardContent>

                      <div className="pointer-events-none absolute bottom-0 right-6 z-20">

                        <div className="relative h-[360px] w-[320px]">
                          <div
                            className={`pointer-events-auto absolute bottom-0 right-0 z-10 h-[360px] w-[320px] overflow-hidden rounded-t-xl border-2 border-slate-300 bg-white shadow-2xl transition-transform duration-500 ease-in-out ${
                              isMiniChatOpen
                                ? "translate-y-0"
                                : "translate-y-[calc(100%-2.30rem)]"
                            }`}
                          >
                            <div
                              className="flex cursor-pointer items-center justify-between border-b border-border bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/70"
                              onClick={() => setIsMiniChatOpen((prev) => !prev)}
                            >
                              <div className="flex items-center gap-1.5">
                                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                                <p className="text-sm font-normal text-foreground">
                                  Message window
                                </p>
                              </div>
                              {isMiniChatOpen ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="grid h-[calc(100%-40px)] grid-rows-[minmax(0,1fr)_auto]">
                              <div
                                ref={miniConversationScrollRef}
                                className="ff-hide-scrollbar min-h-0 overflow-y-auto p-3"
                              >
                                {isMessagesLoading ? (
                                  <p className="text-sm text-black">
                                    Loading conversation...
                                  </p>
                                ) : null}
                                {!isMessagesLoading && messages.length === 0 ? (
                                  <p className="text-sm text-black">
                                    No messages yet.
                                  </p>
                                ) : null}
                                <div className="space-y-3">
                                  {(() => {
                                    let lastDayLabel = "";
                                    return messages.map(
                                      (entry, index, allMessages) => {
                                        const createdAt = entry.createdAt
                                          ? new Date(entry.createdAt)
                                          : null;
                                        const today = new Date();
                                        const yesterday = new Date();
                                        yesterday.setDate(today.getDate() - 1);
                                        const dayLabel = createdAt
                                          ? createdAt.toDateString() ===
                                            today.toDateString()
                                            ? "Today"
                                            : createdAt.toDateString() ===
                                                yesterday.toDateString()
                                              ? "Yesterday"
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
                                          dayLabel && dayLabel !== lastDayLabel;
                                        if (showDayLabel) {
                                          lastDayLabel = dayLabel;
                                        }

                                        const isUser =
                                          entry.senderRole === "user";
                                        const name = isUser
                                          ? "You"
                                          : entry.senderName || "Admin";
                                        const prev =
                                          index > 0
                                            ? allMessages[index - 1]
                                            : null;
                                        const prevIsUser = prev
                                          ? prev.senderRole === "user"
                                          : false;
                                        const prevName = prev
                                          ? prevIsUser
                                            ? "You"
                                            : prev.senderName || "Admin"
                                          : "";
                                        const showName =
                                          !prev ||
                                          showDayLabel ||
                                          prev.senderRole !==
                                            entry.senderRole ||
                                          prevName !== name;
                                        const isLikelyMultiLine =
                                          (entry.message || "").includes(
                                            "\n",
                                          ) ||
                                          (entry.message || "").length > 50;

                                        return (
                                          <div
                                            key={`mini-${entry.id}`}
                                            className="space-y-2"
                                          >
                                            {showDayLabel ? (
                                              <div className="flex items-center gap-2 py-1">
                                                <div className="h-px flex-1 bg-border/60" />
                                                <span className="text-[10px] font-normal text-black">
                                                  {dayLabel}
                                                </span>
                                                <div className="h-px flex-1 bg-border/60" />
                                              </div>
                                            ) : null}
                                            <div
                                              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                            >
                                              <div
                                                className={`group relative w-fit min-w-0 max-w-[85%] ${isUser ? "text-right" : "text-left"}`}
                                              >
                                                {showName && !isUser ? (
                                                  <p className="mb-1 px-1 text-[11px] font-normal text-black">
                                                    {name}
                                                  </p>
                                                ) : null}
                                                <div
                                                  className={`rounded-2xl px-3 py-2 text-xs ${
                                                    isUser
                                                      ? USER_MESSAGE_BUBBLE_CLASS
                                                      : "border border-border bg-slate-50 text-foreground"
                                                  }`}
                                                >
                                                  <p className="whitespace-pre-line break-words">
                                                    {entry.message}
                                                  </p>
                                                </div>
                                                {entry.createdAt ? (
                                                  <span
                                                    className={`pointer-events-none absolute z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-black/50 px-2.5 py-1 text-[10px] text-white shadow-sm group-hover:inline-flex ${
                                                      isUser
                                                        ? "-left-1 -translate-x-full"
                                                        : "-right-1 translate-x-full"
                                                    } ${
                                                      isLikelyMultiLine
                                                        ? "top-1/2"
                                                        : "top-[68%]"
                                                    }`}
                                                  >
                                                    {formatLocalTime(
                                                      entry.createdAt,
                                                    )}
                                                  </span>
                                                ) : null}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      },
                                    );
                                  })()}
                                </div>
                              </div>
                              <div className="border-t border-border bg-background/90 p-2">
                                <div className="flex items-end gap-2">
                                  <Textarea
                                    id="mini-reply-message"
                                    placeholder="Type your message..."
                                    rows={1}
                                    value={messageDraft}
                                    onChange={(e) =>
                                      setMessageDraft(
                                        e.target.value.slice(
                                          0,
                                          CONVERSATION_MESSAGE_MAX_LENGTH,
                                        ),
                                      )
                                    }
                                    maxLength={CONVERSATION_MESSAGE_MAX_LENGTH}
                                    disabled={isSendingMessage}
                                    className="ff-hide-scrollbar w-full max-w-full min-w-0 max-h-[8rem] min-h-8 resize-none overflow-y-auto rounded-lg border border-border/70 bg-background px-3 py-2 text-xs leading-relaxed [field-sizing:fixed] [max-inline-size:100%] [overflow-wrap:anywhere] [word-break:break-word] [white-space:pre-wrap]"
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === "Enter" &&
                                        !event.shiftKey
                                      ) {
                                        event.preventDefault();
                                        void handleSendMessage();
                                      }
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    onClick={handleSendMessage}
                                    size="icon"
                                    variant="secondary"
                                    className="h-9 w-9 shrink-0 rounded-lg border border-border/70 bg-muted/80 text-muted-foreground hover:bg-accent hover:text-white"
                                    disabled={isSendingMessage}
                                    aria-label="Send quick chat message"
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label={
                            isMiniChatOpen
                              ? "Hide quick chat"
                              : "Open quick chat"
                          }
                          onClick={() => setIsMiniChatOpen((prev) => !prev)}
                          className="pointer-events-auto absolute bottom-0 right-0 z-0 h-8 w-[320px] cursor-pointer rounded-t-md border border-b-0 border-border bg-muted/90 px-6 text-xs font-normal text-foreground shadow-md transition-colors hover:bg-muted"
                        >
                          {isMiniChatOpen ? "Updates" : "Updates"}
                        </button>
                      </div>
                    </Card>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}