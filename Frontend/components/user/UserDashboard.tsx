"use client";
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { parseAdminResponses } from "@/lib/responseLog";
import { formatLocalTime } from "@/lib/time";
import { useDraftStorage } from "@/lib/useDraftStorage";
import { toastApiError } from "@/lib/errorHandling";
import { FeedbackDetailsCard } from "@/components/feedback/FeedbackDetailsCard";
import { FeedbackStatusCard } from "@/components/feedback/FeedbackStatusCard";
import {
  ArrowRight,
  Send,
  Search,
  Clock,
  CheckCircle,
  Circle,
  Wrench,
  MessageCircle,
  X,
  Copy,
} from "lucide-react";

export type UserDashboardView = "track-feedback" | "my-submissions" | "submit-feedback";

export function UserDashboard({ view }: { view: UserDashboardView }) {
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
  const [searchTrackingId, setSearchTrackingId] = useState("");
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
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [leftColumnHeight, setLeftColumnHeight] = useState<number | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const submissionsScrollRef = useRef<HTMLDivElement | null>(null);
  const submissionsScrollTop = useRef(0);
  const submissionsScrollKey = "userDashboardSubmissionsScrollTop";
  const isTrackView = view === "track-feedback";
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

    setConfirmData({
      ...formData,
      category: formData.category.trim(),
    });
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!currentUser) return;
    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;
    try {
      await createFeedback({
        id: newTrackingId,
        type: confirmData.type,
        category: confirmData.category.trim(),
        subject: confirmData.subject,
        message: confirmData.message,
        status: "Pending",
        priority: formData.priority || "Medium",
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit feedback.";
      if (message.toLowerCase().includes("log in again")) {
        handleLogout();
        return;
      }
      toast.error(message);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputId = searchTrackingId.trim();
    if (!inputId) {
      toast.error("Please enter your tracking ID.");
      return;
    }
    const matched = feedbacks.find(
      (feedback) => feedback.id.toLowerCase() === inputId.toLowerCase(),
    );
    if (!matched) {
      setSelectedFeedback(null);
      toast.error(
        "Tracking ID not found in your submissions. Please use the ID provided by the system.",
      );
      return;
    }
    try {
      const found = await getFeedback(matched.id);
      setSelectedFeedback(found);
      setSearchTrackingId(matched.id);
      toast.success("Feedback found!");
    } catch {
      setSelectedFeedback(null);
      toast.error("Feedback not found. Please check your tracking ID.");
    }
  };

  const handleViewFeedback = async (feedback: Feedback) => {
    try {
      const latest = await getFeedback(feedback.id);
      setSelectedFeedback(latest);
      setSearchTrackingId(latest.id);
    } catch {
      setSelectedFeedback(feedback);
      setSearchTrackingId(feedback.id);
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

  const formatMessagePreview = (value: string) => {
    if (!value) return value;
    let result = value.replace(/(^\s*[a-z])/, (match) => match.toUpperCase());
    result = result.replace(/([.!?]\s+)([a-z])/g, (_, spacer, letter) => {
      return spacer + String(letter).toUpperCase();
    });
    return result;
  };

  return (
    <>
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted">
      {trackingId && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 py-8 animate-in fade-in-0"
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
              </div>
              <div className="min-w-0 rounded-lg border bg-white p-4 border-l-4 border-l-orange-400 pl-3">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  SEVERITY
                </p>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {confirmData.priority || "—"}
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
              onClick={() => setIsConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              onClick={handleConfirmSubmit}
            >
              Confirm & Submit
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
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className={`grid gap-6 sm:gap-8 items-stretch ${isMySubmissionsView ? "lg:grid-cols-1" : "lg:grid-cols-2"}`}>
          {!isMySubmissionsView && (
            <div ref={leftColumnRef} className="flex flex-col gap-6">
            {/* Track Feedback */}
            {isTrackView && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Track Your Feedback</h2>

              <Card className="shadow-lg mb-6">
                <CardHeader>
                  <CardTitle>Enter Tracking ID</CardTitle>
                  <CardDescription>
                    Search for your submitted feedback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                    <Input
                      placeholder="e.g., FF-ABC123XYZ"
                      value={searchTrackingId}
                      onChange={(e) => setSearchTrackingId(e.target.value)}
                      required
                    />
                    <Button
                      type="submit"
                      className="bg-accent hover:bg-accent/90"
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </Button>
                  </form>
                </CardContent>
              </Card>

            </div>
            )}

            {/* Submit Feedback */}
            {isSubmitView && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Submit Feedback</h2>
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Feedback Form</CardTitle>
                  <CardDescription>
                    Check anonymous if you want your name hidden from
                    admin views.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Feedback Type *</Label>
                      {isHydrated ? (
                        <Select
                          value={formData.type}
                          onValueChange={(value) =>
                            setFormData({ ...formData, type: value })
                          }
                          required
                        >
                          <SelectTrigger id="type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="suggestion">
                              Suggestion
                            </SelectItem>
                            <SelectItem value="complaint">Complaint</SelectItem>
                            <SelectItem value="inquiry">Inquiry</SelectItem>
                            <SelectItem value="request">Request</SelectItem>
                            <SelectItem value="compliment">Compliment</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div
                          className="h-10 rounded-md border bg-muted/30"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      {isHydrated ? (
                        <Select
                          value={formData.category}
                          onValueChange={(value) =>
                            setFormData({ ...formData, category: value })
                          }
                          required
                        >
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div
                          className="h-10 rounded-md border bg-muted/30"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority">Severity Level *</Label>
                      {isHydrated ? (
                        <Select
                          value={formData.priority}
                          onValueChange={(value) =>
                            setFormData({ ...formData, priority: value })
                          }
                          required
                        >
                          <SelectTrigger id="priority">
                            <SelectValue placeholder="Select severity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div
                          className="h-10 rounded-md border bg-muted/30"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject *</Label>
                      <Input
                        id="subject"
                        placeholder="Brief summary of your feedback"
                        value={formData.subject}
                        onChange={(e) =>
                          setFormData({ ...formData, subject: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message *</Label>
                      <Textarea
                        id="message"
                        placeholder="Provide detailed information about your feedback..."
                        rows={5}
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                      <Checkbox
                        id="is-anonymous"
                        checked={isAnonymous}
                        onCheckedChange={(checked) =>
                          setIsAnonymous(checked === true)
                        }
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="is-anonymous"
                          className="cursor-pointer text-sm font-medium"
                        >
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
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Submit Feedback
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
            )}
          </div>
          )}

          {(isMySubmissionsView || isTrackView) && (
          <div
            className="flex flex-col min-h-0 h-full overflow-hidden"
            style={leftColumnHeight ? { height: leftColumnHeight } : undefined}
          >
            {selectedFeedback ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <button
                  type="button"
                  aria-label="Close feedback details"
                  className="ff-modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                  onClick={() => {
                    setSelectedFeedback(null);
                    setSearchTrackingId("");
                  }}
                />
                <Card className="ff-modal-panel relative z-10 w-full max-w-4xl h-[90vh] min-h-0 flex flex-col overflow-hidden shadow-2xl">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>Feedback Details</CardTitle>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedFeedback(null);
                          setSearchTrackingId("");
                        }}
                      >
                        Close
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
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-foreground">
                        <MessageCircle className="h-5 w-5" />
                        Conversation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border bg-white/70 p-4">
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
                              const dayLabel = createdAt
                                ? createdAt.toDateString() ===
                                  today.toDateString()
                                  ? "Today"
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

                              const isUser = entry.senderRole === "user";
                              const name = isUser ? "You" : entry.senderName;
                              const prev = index > 0 ? allMessages[index - 1] : null;
                              const prevIsUser = prev ? prev.senderRole === "user" : false;
                              const prevName = prev
                                ? prevIsUser
                                  ? "You"
                                  : prev.senderName
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
                                  {showDayLabel && (
                                    <div className="flex justify-center">
                                      <span className="rounded-full border border-border bg-white/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                                        {dayLabel}
                                      </span>
                                    </div>
                                  )}
                                  <div
                                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                  >
                                    <div
                                      className={`group relative w-fit min-w-0 max-w-[78%] sm:max-w-md ${isUser ? "text-right" : "text-left"}`}
                                    >
                                      {showName && (
                                        <p className="mb-1 px-1 text-sm font-semibold text-muted-foreground">
                                          {name}
                                        </p>
                                      )}
                                      <div
                                        className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                          isUser
                                            ? "bg-accent text-white"
                                            : "bg-white text-foreground border border-border"
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
                                      {entry.createdAt && (
                                        <span
                                          className={`pointer-events-none absolute z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-2xl bg-black/50 px-4 py-3 text-sm text-white shadow-sm group-hover:inline-flex ${
                                            isUser
                                              ? "-left-1 -translate-x-full"
                                              : "-right-1 translate-x-full"
                                          } ${
                                            isLikelyMultiLine
                                              ? "top-1/2"
                                              : "top-[68%]"
                                          }`}
                                        >
                                          {new Date(entry.createdAt).toLocaleDateString(
                                            "en-US",
                                            { weekday: "long" },
                                          )}{" "}
                                          {formatLocalTime(entry.createdAt)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reply-message">Send a reply</Label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Textarea
                            id="reply-message"
                            placeholder="Type your message..."
                            rows={2}
                            value={messageDraft}
                            onChange={(e) => setMessageDraft(e.target.value)}
                            disabled={isSendingMessage}
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
                            className="bg-accent hover:bg-accent/90"
                            disabled={isSendingMessage}
                          >
                            {isSendingMessage ? "Sending..." : "Send"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </CardContent>
                </Card>
              </div>
            ) : isMySubmissionsView && feedbacks.length > 0 ? (
              <Card className="shadow-lg h-full min-h-0 flex flex-col overflow-hidden">
                <CardHeader>
                  <CardTitle>My Submissions</CardTitle>
                  <CardDescription>
                    Your recent feedback submissions
                  </CardDescription>
                </CardHeader>
                <CardContent
                  ref={submissionsScrollRef}
                  className="space-y-4 flex-1 min-h-0 overflow-y-auto max-h-[420px] sm:max-h-none"
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
                  {[...feedbacks].sort((a, b) => {
                    const order = ["pending", "in progress", "resolved"];
                    const aIndex = order.indexOf(a.status.toLowerCase());
                    const bIndex = order.indexOf(b.status.toLowerCase());
                    const safeA = aIndex === -1 ? order.length : aIndex;
                    const safeB = bIndex === -1 ? order.length : bIndex;
                    return safeA - safeB;
                  }).map((feedback) => (
                    <div
                      key={feedback.id}
                      className="relative p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleViewFeedback(feedback)}
                    >
                      {feedback.status.toLowerCase() === "pending" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 h-6 w-6 rounded-full text-rose-600 hover:bg-rose-600 hover:text-white"
                          aria-label="Delete submission"
                          title="Delete submission"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(feedback);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="min-w-0 flex-1 font-semibold break-words break-all">
                          {feedback.subject}
                        </p>
                        <div className="w-14 flex justify-center flex-shrink-0 pt-0.5 mr-6">
                          {(() => {
                            const StatusIcon = getStatusIcon(feedback.status);
                            return (
                              <span
                                aria-label={feedback.status}
                                title={feedback.status}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-sm ${getStatusIndicatorClass(
                                  feedback.status,
                                )}`}
                              >
                                <StatusIcon className="h-[18px] w-[18px]" />
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-mono">{feedback.id}</span>
                        <span className="w-14 text-center mr-6 inline-block translate-y-1">
                          {new Date(feedback.createdAt).toLocaleDateString(
                            "en-US",
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : isTrackView ? (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Tracking Search</CardTitle>
                  <CardDescription>
                    Enter your tracking ID and open the matching feedback details.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <Card className="shadow-lg h-full flex flex-col">
                <CardContent className="pt-6 flex-1 flex items-center">
                  <div className="text-center py-8 w-full">
                    <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Submissions Yet
                    </h3>
                    <p className="text-muted-foreground">
                      Submit your first feedback using the form on the left.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  </>
  );
}




