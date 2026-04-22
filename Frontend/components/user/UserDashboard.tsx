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
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { parseAdminResponses } from "@/lib/responseLog";
import { formatLocalTime } from "@/lib/time";
import { useDraftStorage } from "@/lib/useDraftStorage";
import { toastApiError } from "@/lib/errorHandling";
import { formatFilterChipLabel } from "@/lib/filterUtils";
import { FeedbackDetailsCard } from "@/components/feedback/FeedbackDetailsCard";
import { FeedbackStatusCard } from "@/components/feedback/FeedbackStatusCard";
import {
  HoverFilterPopover,
  type HoverFilterItem,
} from "@/components/filters/HoverFilterPopover";
import {
  ArrowRight,
  Send,
  Search,
  Clock,
  CheckCircle,
  Circle,
  Wrench,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Copy,
  Plus,
} from "lucide-react";

export type UserDashboardView = "home" | "my-submissions" | "submit-feedback";

const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;
const FEEDBACK_SUBJECT_MAX_LENGTH = 100;

export function UserDashboard({ view }: { view: UserDashboardView }) {
  const MY_SUBMISSIONS_PER_PAGE = 7;
  type HoverFilterKey =
    | "tracking"
    | "date"
    | "type"
    | "category"
    | "priority"
    | "status";
  const router = useRouter();
  const draftKey = "userFeedbackDraft";
  const emptyForm = {
    type: "",
    category: "",
    priority: "",
    subject: "",
    message: "",
  };
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
  const [createSubmissionStep, setCreateSubmissionStep] = useState<
    "form" | "confirm" | "success"
  >("form");
  const [createSubmissionTrackingId, setCreateSubmissionTrackingId] =
    useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("recent");
  const [filterTracking, setFilterTracking] = useState("asc");
  const [mySubmissionsPage, setMySubmissionsPage] = useState(1);
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
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const submissionsScrollRef = useRef<HTMLDivElement | null>(null);
  const submissionsScrollTop = useRef(0);
  const feedbackSubmitLockRef = useRef(false);
  const submissionsScrollKey = "userDashboardSubmissionsScrollTop";
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

  const restoreSubmissionsScroll = useCallback((force = false) => {
    if (!force && (selectedFeedback || trackingId)) return;
    const node = submissionsScrollRef.current;
    if (!node) return;
    const top = submissionsScrollTop.current;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        node.scrollTop = top;
      });
    });
  }, [selectedFeedback, trackingId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(submissionsScrollKey);
    if (stored) {
      const value = Number.parseInt(stored, 10);
      submissionsScrollTop.current = Number.isNaN(value) ? 0 : value;
    }
  }, [submissionsScrollKey]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedFeedback || trackingId) return;
    const stored = window.localStorage.getItem(submissionsScrollKey);
    if (stored) {
      const value = Number.parseInt(stored, 10);
      submissionsScrollTop.current = Number.isNaN(value) ? 0 : value;
    }
    restoreSubmissionsScroll();
  }, [feedbacks.length, selectedFeedback, trackingId, leftColumnHeight, restoreSubmissionsScroll]);

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
      toast.error(`Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or less.`);
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
      toast.error(`Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or less.`);
      return;
    }

    setConfirmData({
      ...formData,
      category: formData.category.trim(),
    });
    setCreateSubmissionStep("confirm");
  };

  const handleCreateSubmissionConfirmSubmit = async () => {
    if (!currentUser) return;
    if (feedbackSubmitLockRef.current) return;
    if (confirmData.message.trim().length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      toast.error(`Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or less.`);
      return;
    }
    feedbackSubmitLockRef.current = true;
    setIsSubmittingFeedback(true);
    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;
    try {
      await createFeedback({
        id: newTrackingId,
        type: confirmData.type,
        category: confirmData.category.trim(),
        subject: confirmData.subject,
        message: confirmData.message,
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
      setCreateSubmissionStep("success");
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
      toast.error(`Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or less.`);
      return;
    }
    feedbackSubmitLockRef.current = true;
    setIsSubmittingFeedback(true);
    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;
    try {
      await createFeedback({
        id: newTrackingId,
        type: confirmData.type,
        category: confirmData.category.trim(),
        subject: confirmData.subject,
        message: confirmData.message,
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
    setIsSendingMessage(true);
    try {
      const created = await createFeedbackMessage(selectedFeedback.id, {
        message: trimmed,
      });
      setMessages((prev) => [...prev, created]);
      setMessageDraft("");
    } catch (error) {
      toastApiError(error, "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const normalizeStatus = (status: string) =>
    status
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  const getStatusIndicatorClass = (status: string) => {
    switch (normalizeStatus(status)) {
      case "pending":
        return "border-amber-300/80 bg-amber-50 text-amber-700";
      case "in progress":
        return "border-orange-300/80 bg-orange-50 text-orange-700";
      case "resolved":
        return "border-emerald-300/80 bg-emerald-50 text-emerald-700";
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
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const closeSelectedFeedback = useCallback(() => {
    setMessageDraft("");
    setSelectedFeedback(null);
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

  const formatMessagePreview = (value: string) => {
    if (!value) return value;
    let result = value.replace(/(^\s*[a-z])/, (match) => match.toUpperCase());
    result = result.replace(/([.!?]\s+)([a-z])/g, (_, spacer, letter) => {
      return spacer + String(letter).toUpperCase();
    });
    return result;
  };

  const renderSubmissionForm = (
    idPrefix: string,
    onSubmit: (e: React.FormEvent) => void = handleSubmit,
  ) => (
    <form onSubmit={onSubmit} className="space-y-5">
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
              <SelectTrigger id={`${idPrefix}-type`}>
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
            <div className="h-10 rounded-md border bg-muted/30" aria-hidden="true" />
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
              <SelectTrigger id={`${idPrefix}-category`}>
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
            <div className="h-10 rounded-md border bg-muted/30" aria-hidden="true" />
          )}
        </div>

      

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-subject`}>Subject *</Label>
        <Input
          id={`${idPrefix}-subject`}
          placeholder="Brief summary of your feedback"
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
          rows={5}
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
        <p className="text-right text-xs text-muted-foreground">
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
          <Label htmlFor={`${idPrefix}-anonymous`} className="cursor-pointer text-sm font-medium">
            Submit anonymously
          </Label>
          <p className="text-sm text-muted-foreground">
            When checked, your name will be hidden to the admins.
          </p>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-accent hover:bg-accent/90"
        disabled={isSubmittingFeedback}
      >
        <Send className="mr-2 h-4 w-4" />
        {isSubmittingFeedback ? "Submitting feedback..." : "Submit Feedback"}
      </Button>
      {isSubmittingFeedback ? (
        <p className="text-center text-xs text-muted-foreground" aria-live="polite">
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
        filterType === "all" || feedback.type.toLowerCase() === filterType;
      const matchesCategory =
        filterCategory === "all" ||
        feedback.category.toLowerCase() === filterCategory.toLowerCase();
      const matchesPriority =
        filterPriority === "all" ||
        feedback.priority.toLowerCase() === filterPriority;
      const normalized = normalizeStatus(feedback.status);
      const matchesStatus =
        filterStatus === "all" ||
        normalized === (filterStatus === "inprogress" ? "in progress" : filterStatus);

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
    Math.ceil(filteredFeedbacks.length / MY_SUBMISSIONS_PER_PAGE),
  );

  const paginatedFilteredFeedbacks = useMemo(() => {
    const startIndex = (mySubmissionsPage - 1) * MY_SUBMISSIONS_PER_PAGE;
    return filteredFeedbacks.slice(
      startIndex,
      startIndex + MY_SUBMISSIONS_PER_PAGE,
    );
  }, [filteredFeedbacks, mySubmissionsPage]);
  const mySubmissionsPlaceholderRowCount = Math.max(
    0,
    MY_SUBMISSIONS_PER_PAGE - paginatedFilteredFeedbacks.length,
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
  ]);

  useEffect(() => {
    if (mySubmissionsPage > mySubmissionsTotalPages) {
      setMySubmissionsPage(mySubmissionsTotalPages);
    }
  }, [mySubmissionsPage, mySubmissionsTotalPages]);

  const activeFilterCount = [
    filterTracking !== "asc",
    filterDate !== "recent",
    filterType !== "all",
    filterCategory !== "all",
    filterPriority !== "all",
    filterStatus !== "all",
  ].filter(Boolean).length;
  const activeFilterChips = [
    trimmedSearchQuery
      ? { key: "search", label: `Search: ${searchQuery.trim()}` }
      : null,
    filterTracking !== "asc"
      ? { key: "tracking", label: "Tracking: Z - A" }
      : null,
    filterDate !== "recent"
      ? { key: "date", label: "Date: Oldest" }
      : null,
    filterType !== "all"
      ? { key: "type", label: `Type: ${formatFilterChipLabel(filterType)}` }
      : null,
    filterCategory !== "all"
      ? {
          key: "category",
          label: `Category: ${formatFilterChipLabel(filterCategory)}`,
        }
      : null,
    filterPriority !== "all"
      ? {
          key: "priority",
          label: `Priority: ${formatFilterChipLabel(filterPriority)}`,
        }
      : null,
    filterStatus !== "all"
      ? {
          key: "status",
          label:
            filterStatus === "inprogress"
              ? "Status: In Progress"
              : `Status: ${formatFilterChipLabel(filterStatus)}`,
        }
      : null,
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
      case "type":
        setFilterType("all");
        break;
      case "category":
        setFilterCategory("all");
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

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setFilterTracking("asc");
    setFilterDate("recent");
    setFilterType("all");
    setFilterCategory("all");
    setFilterPriority("all");
    setFilterStatus("all");
  }, []);
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
          label: filterType === "all" ? "All Types" : formatFilterChipLabel(filterType),
          options: [
            { value: "all", label: "All Types" },
            { value: "suggestion", label: "Suggestion" },
            { value: "complaint", label: "Complaint" },
            { value: "inquiry", label: "Inquiry" },
            { value: "request", label: "Request" },
            { value: "compliment", label: "Compliment" },
          ],
          isSelected: (value: string) => filterType === value,
          onSelect: setFilterType,
        },
        {
          key: "category" as const,
          label: filterCategory === "all" ? "All Categories" : formatFilterChipLabel(filterCategory),
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
          label: filterPriority === "all" ? "All Priorities" : formatFilterChipLabel(filterPriority),
          options: [
            { value: "all", label: "All Priorities" },
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ],
          isSelected: (value: string) => filterPriority === value,
          onSelect: setFilterPriority,
        },
        {
          key: "status" as const,
          label: filterStatus === "all" ? "All Status" : formatFilterChipLabel(filterStatus),
          options: [
            { value: "all", label: "All Status" },
            { value: "pending", label: "Pending" },
            { value: "inprogress", label: "In Progress" },
            { value: "resolved", label: "Resolved" },
          ],
          isSelected: (value: string) => filterStatus === value,
          onSelect: setFilterStatus,
        },
      ] satisfies HoverFilterItem<HoverFilterKey>[],
    [categories, filterCategory, filterDate, filterPriority, filterStatus, filterTracking, filterType],
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
      [...feedbacks]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 6),
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
        )
        .slice(0, 6),
    [feedbacks],
  );

  const recentlyUpdatedCards = useMemo(
    () =>
      [...feedbacks]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 6),
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

  const renderHomeSubmissionGrid = (
    items: Feedback[],
    emptyMessage: string,
  ) => {
    const visibleItems = items.slice(0, 6);
    if (items.length === 0) {
      return (
        <Card className="border shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((feedback) => (
          <button
            key={feedback.id}
            type="button"
            onClick={() => handleViewFeedback(feedback)}
            className="w-full text-left"
          >
            <Card className="h-full border shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 break-words font-semibold leading-snug">
                    {feedback.subject}
                  </p>
                  <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {new Date(feedback.createdAt).toLocaleDateString("en-US")}
                  </span>
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {feedback.id}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {feedback.message}
                </p>
                <div className="flex items-center justify-between">
                  <span className="rounded-md border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                    {feedback.category}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    {(() => {
                      const StatusIcon = getStatusIcon(feedback.status);
                      return (
                        <>
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${getStatusIndicatorClass(
                              feedback.status,
                            )}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                          </span>
                          {feedback.status}
                        </>
                      );
                    })()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    );
  };

  const renderCreateSubmissionDialog = () => (
    <Dialog
      open={isCreateSubmissionOpen}
      onOpenChange={(open) => {
        setIsCreateSubmissionOpen(open);
        if (!open) {
          setCreateSubmissionStep("form");
          setCreateSubmissionTrackingId(null);
        }
      }}
    >
      <DialogContent className="ff-modal-panel w-[calc(100%-1.5rem)] max-w-2xl p-5 sm:w-full sm:p-6">
        {createSubmissionStep === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Feedback Form</DialogTitle>
              <DialogDescription>
                Fill out the details below to create a new submission.
              </DialogDescription>
            </DialogHeader>
            {renderSubmissionForm(
              "modal",
              handleCreateSubmissionFormSubmit,
            )}
          </>
        ) : null}
        {createSubmissionStep === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Your Feedback</DialogTitle>
              <DialogDescription>
                Please review the details before submitting.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    TYPE
                  </p>
                  <p className="mt-1 text-sm font-semibold capitalize">
                    {confirmData.type || "—"}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    CATEGORY
                  </p>
                  <p className="mt-1 text-sm font-semibold break-words break-all">
                    {confirmData.category || "—"}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    ANONYMOUS
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {isAnonymous ? "Yes" : "No"}
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    SUBJECT
                  </p>
                  <p className="mt-1 font-semibold break-words break-all">
                    {formatMessagePreview(confirmData.subject) || "—"}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    MESSAGE
                  </p>
                  <p className="mt-1 text-sm leading-relaxed break-all">
                    {formatMessagePreview(confirmData.message) || "—"}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateSubmissionStep("form")}
              >
                Back
              </Button>
              <Button
                className="bg-accent hover:bg-accent/90"
                onClick={handleCreateSubmissionConfirmSubmit}
                disabled={isSubmittingFeedback}
              >
                {isSubmittingFeedback ? "Submitting feedback..." : "Confirm & Submit"}
              </Button>
            </div>
          </>
        ) : null}
        {createSubmissionStep === "success" ? (
          <>
            <DialogHeader>
              <DialogTitle>Feedback Submitted!</DialogTitle>
              <DialogDescription>
                Your feedback has been received successfully.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="w-full bg-muted rounded-lg p-4 text-center relative">
                <p className="text-sm text-muted-foreground mb-2">
                  Your Tracking ID
                </p>
                <p className="text-2xl font-bold text-primary">
                  {createSubmissionTrackingId}
                </p>
                {createSubmissionTrackingId ? (
                  <button
                    type="button"
                    className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-white/80 text-muted-foreground hover:bg-white hover:text-foreground"
                    onClick={() => copyToClipboard(createSubmissionTrackingId)}
                    aria-label="Copy tracking ID"
                    title="Copy tracking ID"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {currentUser?.email ? (
                <p className="text-xs text-muted-foreground text-center">
                  A copy of this tracking ID was sent to{" "}
                  {currentUser.email}.
                </p>
              ) : null}
              <div className="mt-2 flex justify-end">
                <Button
                  className="bg-accent hover:bg-accent/90"
                  onClick={() => {
                    setIsCreateSubmissionOpen(false);
                    setCreateSubmissionStep("form");
                    setCreateSubmissionTrackingId(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  return (
    <>
    <div className="min-h-[calc(100vh-200px)] bg-muted/20">
      {trackingId && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4 py-8 animate-in fade-in-0"
          onClick={() => {
            setTrackingId(null);
            setSelectedFeedback(null);
            setTimeout(() => {
              restoreSubmissionsScroll(true);
            }, 200);
          }}
        >
          <div className="w-full max-w-lg -translate-y-[10%]">
            <Card
              className="relative shadow-lg animate-in zoom-in-95 fade-in-0"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
                onClick={() => {
                  setTrackingId(null);
                  setSelectedFeedback(null);
                  setTimeout(() => {
                    restoreSubmissionsScroll(true);
                  }, 200);
                }}
              >
                <X className="h-4 w-4" />
              </button>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <ArrowRight className="h-8 w-8 text-accent" />
                </div>
                <CardTitle>Feedback Submitted!</CardTitle>
                <CardDescription>
                  Your feedback has been received successfully
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-full bg-muted rounded-lg p-4 text-center relative">
                  <p className="text-sm text-muted-foreground mb-2">
                    Your Tracking ID
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {trackingId}
                  </p>
                  <button
                    type="button"
                    className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-white/80 text-muted-foreground hover:bg-white hover:text-foreground"
                    onClick={() => copyToClipboard(trackingId)}
                    aria-label="Copy tracking ID"
                    title="Copy tracking ID"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Please save this tracking ID to check the status of your
                  submission.
                </p>
                {currentUser?.email && (
                  <p className="text-xs text-muted-foreground text-center">
                    A copy of this tracking ID was sent to {currentUser.email}.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:w-full sm:p-6">
          <DialogHeader>
            <DialogTitle>Confirm Your Feedback</DialogTitle>
            <DialogDescription>
              Please review the details before submitting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  TYPE
                </p>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {confirmData.type || "—"}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  CATEGORY
                </p>
                <p className="mt-1 text-sm font-semibold break-words break-all">
                  {confirmData.category || "—"}
                </p>
              </div>              <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  ANONYMOUS
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {isAnonymous ? "Yes" : "No"}
                </p>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  SUBJECT
                </p>
                <p className="mt-1 font-semibold break-words break-all">
                  {formatMessagePreview(confirmData.subject) || "—"}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  MESSAGE
                </p>
                <p className="mt-1 text-sm leading-relaxed break-all">
                  {formatMessagePreview(confirmData.message) || "—"}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              onClick={handleConfirmSubmit}
              disabled={isSubmittingFeedback}
            >
              {isSubmittingFeedback ? "Submitting feedback..." : "Confirm & Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Submission?</DialogTitle>
            <DialogDescription>
              This will permanently remove your pending feedback.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="min-w-0 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-semibold break-words break-all">
                {deleteTarget.subject}
              </p>
              <p className="mt-1 text-xs text-muted-foreground font-mono break-all">
                {deleteTarget.id}
              </p>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false);
                setDeleteTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) {
                  await handleDeleteFeedback(deleteTarget);
                }
                setIsDeleteOpen(false);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
                closeSelectedFeedback();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div
        className={`mx-auto w-full px-4 ${
          isHomeView ? "pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5" : "py-6 sm:px-6 sm:py-8"
        } ${
          isMySubmissionsView || isHomeView ? "max-w-none" : "max-w-5xl"
        }`}
      >
        <div className="grid gap-6 sm:gap-8 items-stretch">
          {isSubmitView && (
            <div ref={leftColumnRef} className="mx-auto w-full max-w-3xl flex flex-col gap-6">
            {/* Submit Feedback */}
            <div>
              <Card className="border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle>Feedback Form</CardTitle>
                  <CardDescription>
                    Check anonymous if you want your name hidden from
                    admin views.
                  </CardDescription>
                </CardHeader>
                <CardContent>{renderSubmissionForm("submit")}</CardContent>
              </Card>
            </div>
          </div>
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
            <div className={selectedFeedback ? "blur-[2px] pointer-events-none select-none" : ""}>
            {isHomeView ? (
              <div className="flex flex-col bg-background">
                {renderCreateSubmissionDialog()}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Card className="border shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                      <p className="mt-1 text-2xl font-semibold">{dashboardStats.total}</p>
                    </CardContent>
                  </Card>
                  <Card className="border shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                      <p className="mt-1 text-2xl font-semibold">{dashboardStats.pending}</p>
                    </CardContent>
                  </Card>
                  <Card className="border shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">In Progress</p>
                      <p className="mt-1 text-2xl font-semibold">{dashboardStats.inProgress}</p>
                    </CardContent>
                  </Card>
                  <Card className="border shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Resolved</p>
                      <p className="mt-1 text-2xl font-semibold">{dashboardStats.resolved}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="mt-4">
                  <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="min-w-0">
                      <Tabs defaultValue="latest">
                        <TabsList className="grid w-full grid-cols-3 gap-2 p-1.5">
                          <TabsTrigger value="latest">Latest</TabsTrigger>
                          <TabsTrigger value="attention">Needs Attention</TabsTrigger>
                          <TabsTrigger value="updated">Recently Updated</TabsTrigger>
                        </TabsList>
                        <TabsContent value="latest" className="mt-3">
                          {renderHomeSubmissionGrid(
                            latestSubmissionCards,
                            "No submissions yet. Click New Submission to create your first one.",
                          )}
                        </TabsContent>
                        <TabsContent value="attention" className="mt-3">
                          {renderHomeSubmissionGrid(
                            needsAttentionCards,
                            "Nothing needs attention right now.",
                          )}
                        </TabsContent>
                        <TabsContent value="updated" className="mt-3">
                          {renderHomeSubmissionGrid(
                            recentlyUpdatedCards,
                            "No recent updates yet.",
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                    <Card className="h-full max-h-[520px] xl:max-h-[387px] border shadow-sm flex flex-col overflow-hidden">
                      <CardHeader className="pb-0">
                        <CardTitle className="text-base">Notifications</CardTitle>
                        <CardDescription>Unresolved updates</CardDescription>
                      </CardHeader>
                      <CardContent className="-mt-3 flex-1 min-h-0 space-y-1.5 pt-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {homeNotifications.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No unread updates.
                          </p>
                        ) : (
                          homeNotifications.map((feedback) => (
                            <button
                              key={feedback.id}
                              type="button"
                              onClick={() => handleViewFeedback(feedback)}
                              className="w-full rounded-md border border-border/70 p-2 text-left hover:bg-muted/30"
                            >
                              <p className="line-clamp-1 text-sm font-medium">
                                {feedback.subject}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(feedback.updatedAt).toLocaleDateString("en-US")}
                              </p>
                            </button>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ) : isMySubmissionsView && feedbacks.length > 0 ? (
              <div className="h-full min-h-0 flex flex-col bg-background">
                <div className="px-1 pb-1">
                  <div className="-mt-2 pb-1 sm:pb-2">
                    <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex w-full gap-2 sm:max-w-md">
                        <div className="relative flex-1">
                          <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search by ID, subject, message, or category"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="h-8 text-sm border-border/60 bg-background pl-8.5 transition-colors duration-200 focus-visible:border-border/60 focus-visible:ring-0 focus-visible:ring-transparent"
                          />
                        </div>
                        <HoverFilterPopover
                          items={hoverFilterItems}
                          activeCount={activeFilterCount}
                          onReset={clearAllFilters}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => {
                          setCreateSubmissionStep("form");
                          setCreateSubmissionTrackingId(null);
                          setIsAnonymous(false);
                          setIsCreateSubmissionOpen(true);
                        }}
                        className="h-9 sm:w-auto bg-accent hover:bg-accent/90 transition-colors duration-150 hover:-translate-y-px"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New Submission
                      </Button>
                    </div>
                    {activeFilterChips.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {activeFilterChips.map((chip) => (
                          <span
                            key={chip.key}
                            className="inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-background px-3 py-1 text-xs text-foreground shadow-sm"
                          >
                            {chip.label}
                              <button
                                type="button"
                                onClick={() => clearSingleFilter(chip.key)}
                                className="rounded-full p-0.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                                aria-label={`Remove ${chip.label} filter`}
                                title={`Remove ${chip.label} filter`}
                              >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                {renderCreateSubmissionDialog()}
                <div
                  ref={submissionsScrollRef}
                  className="flex-1 min-h-0 w-full max-w-full overflow-y-scroll overflow-x-hidden [scrollbar-gutter:stable_both-edges] h-[calc(100vh-260px)]"
                  onScroll={(event) => {
                    const top = event.currentTarget.scrollTop;
                    submissionsScrollTop.current = top;
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(
                        submissionsScrollKey,
                        top.toString(),
                      );
                    }
                  }}
                >
                  <div className="w-full max-w-full overflow-x-auto">
                    <Table className="w-full min-w-[980px] table-fixed text-xs sm:text-sm [&_td]:px-3 [&_th]:px-3">
                      <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="w-[150px]">Tracking ID</TableHead>
                          <TableHead className="w-[300px]">Subject</TableHead>
                          <TableHead className="w-[220px]">Category</TableHead>
                          <TableHead className="w-[110px]">Priority</TableHead>
                          <TableHead className="w-[150px]">Status</TableHead>
                          <TableHead className="w-[130px] whitespace-nowrap">Date</TableHead>
                          <TableHead className="w-[88px] text-center">Actions</TableHead>
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
                              onClick={() => handleViewFeedback(feedback)}
                            >
                              <TableCell className="font-mono text-xs text-muted-foreground truncate">
                                {feedback.id}
                              </TableCell>
                              <TableCell className="font-medium truncate" title={feedback.subject}>
                                {feedback.subject}
                              </TableCell>
                              <TableCell className="truncate" title={feedback.category}>
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
                                      <>
                                        <span
                                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${getStatusIndicatorClass(
                                            feedback.status,
                                          )}`}
                                        >
                                          <StatusIcon className="h-3.5 w-3.5" />
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {feedback.status}
                                        </span>
                                      </>
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
                                      setDeleteTarget(feedback);
                                      setIsDeleteOpen(true);
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
                        {filteredFeedbacks.length > 0 &&
                          mySubmissionsPlaceholderRowCount > 0
                          ? Array.from({
                              length: mySubmissionsPlaceholderRowCount,
                            }).map((_, index) => (
                              <TableRow
                                key={`submission-placeholder-row-${index}`}
                                className="h-14"
                                aria-hidden="true"
                              >
                                <TableCell colSpan={7} />
                              </TableRow>
                            ))
                          : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {filteredFeedbacks.length > 0 ? (
                  <div className="shrink-0 border-t border-border/60 bg-background pt-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() =>
                          setMySubmissionsPage((page) => Math.max(1, page - 1))
                        }
                        disabled={mySubmissionsPage === 1}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {mySubmissionsPage} of {mySubmissionsTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() =>
                          setMySubmissionsPage((page) =>
                            Math.min(mySubmissionsTotalPages, page + 1),
                          )
                        }
                        disabled={mySubmissionsPage === mySubmissionsTotalPages}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
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
            )}
            </div>
            {selectedFeedback ? (
              <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                <button
                  type="button"
                  aria-label="Close feedback details"
                  className="ff-modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                  onClick={handleAttemptCloseSelectedFeedback}
                />
                <Card className="ff-modal-panel relative z-10 w-full max-w-4xl h-[90vh] min-h-0 flex flex-col overflow-hidden shadow-2xl">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>Feedback Details</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        aria-label="Close feedback details"
                        onClick={handleAttemptCloseSelectedFeedback}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription className="font-mono">
                      {selectedFeedback.id}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-6">
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <FeedbackStatusCard
                    feedback={selectedFeedback}
                    formatDate={formatDate}
                    className="xl:col-span-6 h-full"
                  />

                  <div className="xl:col-span-6">
                    <FeedbackDetailsCard
                      feedback={selectedFeedback}
                      title="Feedback Details"
                      formatDate={formatDate}
                      className="h-full"
                    />
                  </div>
                  </div>

                  <Card className="shadow-lg bg-muted/40 border-border">
                    <CardContent className="pt-6">
                      <div className="grid max-h-[420px] min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-border bg-white/70">
                        <div className="ff-hide-scrollbar min-h-0 overflow-y-auto p-4">
                          {isMessagesLoading && (
                            <p className="text-sm text-muted-foreground">
                              Loading conversation...
                            </p>
                          )}
                          {!isMessagesLoading && messages.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No messages yet. Updates from the admin team will appear here.
                            </p>
                          )}
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

                                const isUser = entry.senderRole === "user";
                                const name = isUser ? "You" : entry.senderName || "Admin";
                                const prev = index > 0 ? allMessages[index - 1] : null;
                                const prevIsUser = prev ? prev.senderRole === "user" : false;
                                const prevName = prev
                                  ? prevIsUser
                                    ? "You"
                                    : prev.senderName || "Admin"
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
                                  <div key={entry.id} className="space-y-3">
                                    {showDayLabel ? (
                                      <div className="flex justify-center">
                                        <span className="rounded-full border border-border bg-white/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                                          {dayLabel}
                                        </span>
                                      </div>
                                    ) : null}
                                    <div
                                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                    >
                                      <div
                                        className={`group relative w-fit min-w-0 max-w-[78%] sm:max-w-md ${isUser ? "text-right" : "text-left"}`}
                                      >
                                        {showName ? (
                                          <p className="mb-1 px-1 text-sm font-semibold text-muted-foreground">
                                            {name}
                                          </p>
                                        ) : null}
                                        <div
                                          className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                            isUser
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
                                          <span
                                            className={`pointer-events-none absolute z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-2xl bg-black/50 px-3 py-1.5 text-xs text-white shadow-sm group-hover:inline-flex ${
                                              isUser
                                                ? "-left-1 -translate-x-full"
                                                : "-right-1 translate-x-full"
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
                        <div className="space-y-2 bg-background/85 p-4 backdrop-blur-sm">
                          <div className="flex items-end gap-2">
                            <Textarea
                              id="reply-message"
                              placeholder="Type your message..."
                              rows={1}
                              value={messageDraft}
                              onChange={(e) => setMessageDraft(e.target.value)}
                              disabled={isSendingMessage}
                              className="max-h-28 min-h-8 resize-none rounded-xl border border-border/70 bg-background px-4 py-2 leading-relaxed shadow-sm focus-visible:ring-2 focus-visible:ring-accent/30"
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
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
                              className="h-12 w-12 shrink-0 rounded-xl border border-border/70 bg-muted/80 text-muted-foreground hover:bg-accent hover:text-white"
                              disabled={isSendingMessage}
                            >
                              <Send className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </CardContent>

                  <div className="pointer-events-none absolute bottom-0 right-5 z-20 flex flex-col items-end gap-2">
                    {isMiniChatOpen ? (
                      <div className="pointer-events-auto h-[360px] w-[320px] overflow-hidden rounded-xl border border-border bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                          <p className="text-sm font-semibold text-foreground">
                            Quick Chat
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setIsMiniChatOpen(false)}
                            aria-label="Collapse quick chat"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid h-[calc(100%-40px)] grid-rows-[minmax(0,1fr)_auto]">
                          <div className="ff-hide-scrollbar min-h-0 overflow-y-auto p-3">
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
                            <div className="space-y-3">
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

                                  const isUser = entry.senderRole === "user";
                                  const name = isUser ? "You" : entry.senderName || "Admin";
                                  const prev = index > 0 ? allMessages[index - 1] : null;
                                  const prevIsUser = prev ? prev.senderRole === "user" : false;
                                  const prevName = prev
                                    ? prevIsUser
                                      ? "You"
                                      : prev.senderName || "Admin"
                                    : "";
                                  const showName =
                                    !prev ||
                                    showDayLabel ||
                                    prev.senderRole !== entry.senderRole ||
                                    prevName !== name;
                                  const isLikelyMultiLine =
                                    (entry.message || "").includes("\n") ||
                                    (entry.message || "").length > 50;

                                  return (
                                    <div key={`mini-${entry.id}`} className="space-y-2">
                                      {showDayLabel ? (
                                        <div className="flex justify-center">
                                          <span className="rounded-full border border-border bg-white/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                                            {dayLabel}
                                          </span>
                                        </div>
                                      ) : null}
                                      <div
                                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                      >
                                        <div
                                          className={`group relative w-fit min-w-0 max-w-[85%] ${isUser ? "text-right" : "text-left"}`}
                                        >
                                          {showName ? (
                                            <p className="mb-1 px-1 text-[11px] font-semibold text-muted-foreground">
                                              {name}
                                            </p>
                                          ) : null}
                                          <div
                                            className={`rounded-2xl px-3 py-2 text-xs ${
                                              isUser
                                                ? "bg-accent text-white"
                                                : "border border-border bg-white text-foreground"
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
                          <div className="border-t border-border bg-background/90 p-2">
                            <div className="flex items-end gap-2">
                              <Textarea
                                id="mini-reply-message"
                                placeholder="Type your message..."
                                rows={1}
                                value={messageDraft}
                                onChange={(e) => setMessageDraft(e.target.value)}
                                disabled={isSendingMessage}
                                className="max-h-24 min-h-8 resize-none rounded-lg border border-border/70 bg-background px-3 py-2 text-xs leading-relaxed"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && !event.shiftKey) {
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
                    ) : null}

                    <button
                      type="button"
                      aria-label={
                        isMiniChatOpen
                          ? "Hide quick chat"
                          : "Open quick chat"
                      }
                      onClick={() => setIsMiniChatOpen((prev) => !prev)}
                      className="pointer-events-auto h-8 rounded-t-xl border border-b-0 border-border bg-muted/90 px-4 text-xs font-semibold text-foreground shadow-md transition-colors hover:bg-muted"
                    >
                      {isMiniChatOpen ? "Hide Chat" : "Quick Chat"}
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







