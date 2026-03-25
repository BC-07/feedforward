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
  deleteFeedback,
  getFeedback,
  listCategories,
  listFeedbacks,
  type Feedback,
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { parseAdminResponses } from "@/lib/responseLog";
import { formatLocalTime } from "@/lib/time";
import { useDraftStorage } from "@/lib/useDraftStorage";
import { toastApiError } from "@/lib/errorHandling";
import {
  ArrowRight,
  Send,
  Search,
  Clock,
  CheckCircle,
  Circle,
  MessageCircle,
  ChevronLeft,
} from "lucide-react";

export default function UserProfile() {
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
  const [leftColumnHeight, setLeftColumnHeight] = useState<number | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const submissionsScrollRef = useRef<HTMLDivElement | null>(null);
  const submissionsScrollTop = useRef(0);
  const submissionsScrollKey = "userDashboardSubmissionsScrollTop";

  async function loadUserFeedbacks(userId: string) {
    try {
      const userFeedbacks = await listFeedbacks({ userId });
      setFeedbacks(userFeedbacks);
    } catch (error) {
      toastApiError(error, "Failed to load feedbacks.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "in progress":
        return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      case "resolved":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "low":
        return "text-gray-600";
      case "medium":
        return "text-yellow-600";
      case "high":
        return "text-orange-600";
      default:
        return "text-gray-600";
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

  const formatAdminTime = formatLocalTime;

  const getStatusMessage = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "Your feedback has been received and is awaiting review.";
      case "in progress":
        return "We are actively working on addressing your feedback.";
      case "resolved":
        return "Your feedback has been addressed and resolved.";
      default:
        return "Your feedback is being processed.";
    }
  };

  const getStatusSteps = (currentStatus: string) => {
    const steps = [
      { name: "Submitted", description: "", completed: true },
      {
        name: "In Progress",
        description: "Actions being taken",
        completed: false,
      },
      { name: "Resolved", description: "Issue addressed", completed: false },
    ];
    const statusOrder = ["pending", "in progress", "resolved"];
    const currentIndex = statusOrder.indexOf(currentStatus.toLowerCase());
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
    }));
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 py-8 animate-in fade-in-0">
          <div className="w-full max-w-lg -translate-y-[10%]">
            <Card className="shadow-lg animate-in zoom-in-95 fade-in-0">
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
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Your Tracking ID
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {trackingId}
                  </p>
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
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(trackingId)}
                  >
                    Copy ID
                  </Button>
                  <Button
                    className="flex-1 bg-accent hover:bg-accent/90"
                    onClick={() => {
                      setTrackingId(null);
                      setSelectedFeedback(null);
                      setTimeout(() => {
                        restoreSubmissionsScroll(true);
                      }, 200);
                    }}
                  >
                    Back to Dashboard
                  </Button>
                </div>
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
      <div className="bg-accent text-accent-foreground">
        <div className="container mx-auto px-4 py-5 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">User Dashboard</h1>
              <p className="text-accent-foreground/80 mt-1 text-sm sm:text-base">
                Welcome, {currentUser?.fullName}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          <div ref={leftColumnRef} className="flex flex-col gap-6">
            {/* Track Feedback */}
            <div className="order-2 sm:order-1">
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

            {/* Submit Feedback */}
            <div className="order-1 sm:order-2">
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
          </div>

          <div
            className="flex flex-col min-h-0 h-full overflow-hidden"
            style={leftColumnHeight ? { height: leftColumnHeight } : undefined}
          >
            {selectedFeedback ? (
              <Card className="shadow-lg h-full min-h-0 flex flex-col overflow-hidden">
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
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back to My Submissions
                    </Button>
                  </div>
                  <CardDescription className="font-mono">
                    {selectedFeedback.id}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex-1 min-h-0 overflow-y-auto">
                  <Card className="shadow-lg">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-6">
                        <h3 className="text-lg font-semibold mb-1">
                          Status:{" "}
                          <span className="uppercase">
                            {selectedFeedback.status}
                          </span>
                        </h3>
                        <Badge
                          className={getStatusColor(selectedFeedback.status)}
                          variant="outline"
                        >
                          {selectedFeedback.status.toLowerCase()}
                        </Badge>
                      </div>

                      <div className="flex items-start gap-3 mb-8 p-4 bg-muted/50 rounded-lg">
                        <Clock className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">
                          {getStatusMessage(selectedFeedback.status)}
                        </p>
                      </div>

                      <div className="space-y-4">
                        {getStatusSteps(selectedFeedback.status).map(
                          (step, index) => (
                            <div key={index} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div
                                  className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    step.completed
                                      ? "bg-green-500/20"
                                      : "bg-gray-200"
                                  }`}
                                >
                                  {step.completed ? (
                                    <CheckCircle className="h-5 w-5 text-green-700" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-gray-400" />
                                  )}
                                </div>
                                {index <
                                  getStatusSteps(selectedFeedback.status)
                                    .length -
                                    1 && (
                                  <div className="h-12 w-px bg-border"></div>
                                )}
                              </div>
                              <div className="pb-4 flex-1">
                                <p className="font-semibold">{step.name}</p>
                                {step.name === "Submitted" && (
                                  <p className="text-sm text-muted-foreground">
                                    {formatDate(selectedFeedback.createdAt)}
                                  </p>
                                )}
                                {step.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {step.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle>Feedback Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">
                          Type
                        </p>
                        <p className="capitalize">{selectedFeedback.type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">
                          Category
                        </p>
                        <p>{selectedFeedback.category}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">
                          Priority
                        </p>
                        <p
                          className={`capitalize ${getPriorityColor(selectedFeedback.priority)}`}
                        >
                          {selectedFeedback.priority}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">
                          Subject
                        </p>
                        <p className="font-semibold break-words">
                          {selectedFeedback.subject}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">
                          Message
                        </p>
                        <p className="text-sm leading-relaxed break-all">
                          {selectedFeedback.message}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">
                          Last Updated
                        </p>
                        <p className="text-sm">
                          {formatDate(selectedFeedback.updatedAt)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedFeedback.response && (
                    <Card className="shadow-lg bg-muted/40 border-border">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-foreground">
                          <MessageCircle className="h-5 w-5" />
                          Updates from Admin
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 max-h-[320px] overflow-y-auto">
                        {parseAdminResponses(selectedFeedback.response).map(
                          (entry, index) => (
                            <div key={`${entry.time ?? "note"}-${index}`}>
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
                          ),
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            ) : feedbacks.length > 0 ? (
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
                      className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleViewFeedback(feedback)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="min-w-0 flex-1 font-semibold break-words break-all">
                          {feedback.subject}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge
                            className={getStatusColor(feedback.status)}
                            variant="outline"
                          >
                            {feedback.status}
                          </Badge>
                          {feedback.status.toLowerCase() === "pending" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs border-destructive text-destructive hover:bg-destructive/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteTarget(feedback);
                                setIsDeleteOpen(true);
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-mono">{feedback.id}</span>
                        <span>
                          {new Date(feedback.createdAt).toLocaleDateString(
                            "en-US",
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
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
        </div>
      </div>
    </div>
  </>
  );
}

