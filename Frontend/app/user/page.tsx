"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFeedback,
  getFeedback,
  listCategories,
  listFeedbacks,
  type Feedback,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  Circle,
  Clock,
  Loader2,
  MessageCircle,
  Search,
  Send,
  User,
  UserX,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ux/async-state";
import { PriorityBadge, RoleBadge, StatusBadge } from "@/components/ux/badges";
import { FieldError, RequiredMark } from "@/components/ux/form-feedback";

type FormData = {
  type: string;
  category: string;
  subject: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

export default function UserProfile() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    fullName: string;
    email: string;
  } | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [searchTrackingId, setSearchTrackingId] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    type: "",
    category: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const loadInitialData = async (userId: string) => {
    setIsLoadingPage(true);
    setLoadError("");
    try {
      const [userFeedbacks, categoryResponse] = await Promise.all([
        listFeedbacks({ userId }),
        listCategories(),
      ]);
      setFeedbacks(Array.isArray(userFeedbacks) ? userFeedbacks : []);
      setCategories(categoryResponse.map((category) => category.name));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load dashboard data.");
    } finally {
      setIsLoadingPage(false);
    }
  };

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
      email: localStorage.getItem("currentUserEmail") || "",
    });
    void loadInitialData(userId);
  }, [router]);

  const submissionCountLabel = useMemo(
    () => `${feedbacks.length} submission${feedbacks.length === 1 ? "" : "s"}`,
    [feedbacks.length],
  );

  const validateForm = () => {
    const nextErrors: FormErrors = {};
    if (!formData.type) nextErrors.type = "Feedback type is required.";
    if (!formData.category) nextErrors.category = "Category is required.";
    if (!formData.subject.trim()) nextErrors.subject = "Subject is required.";
    if (!formData.message.trim()) nextErrors.message = "Message is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Tracking ID copied.");
    } catch {
      toast.error("Failed to copy. Please copy manually.");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !validateForm()) {
      return;
    }

    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;
    setIsSubmitting(true);
    try {
      await createFeedback({
        id: newTrackingId,
        type: formData.type,
        category: formData.category.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        status: "Pending",
        priority: "Medium",
        isAnonymous,
        userId: currentUser.id,
        userName: currentUser.fullName,
        response: "",
      });
      setTrackingId(newTrackingId);
      setFormData({ type: "", category: "", subject: "", message: "" });
      setErrors({});
      setFeedbacks(await listFeedbacks({ userId: currentUser.id }));
      toast.success("Feedback submitted successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit feedback.";
      if (message.toLowerCase().includes("log in again")) {
        localStorage.removeItem("isUserLoggedIn");
        localStorage.removeItem("currentUserId");
        localStorage.removeItem("currentUserName");
        localStorage.removeItem("currentUserEmail");
        toast.error("Session expired. Please log in again.");
        router.push("/login");
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchTrackingId.trim()) {
      toast.error("Tracking ID is required.");
      return;
    }

    setIsSearching(true);
    try {
      const found = await getFeedback(searchTrackingId.trim());
      setSelectedFeedback(found);
      toast.success("Feedback found.");
    } catch {
      setSelectedFeedback(null);
      toast.error("Feedback not found. Please check your tracking ID.");
    } finally {
      setIsSearching(false);
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

  const getStatusSteps = (currentStatus: string) => {
    const steps = [
      { name: "Submitted", description: "", completed: true },
      { name: "In Progress", description: "Actions being taken", completed: false },
      { name: "Resolved", description: "Issue addressed", completed: false },
    ];
    const statusOrder = ["pending", "in progress", "resolved"];
    const currentIndex = statusOrder.indexOf(currentStatus.toLowerCase());
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
    }));
  };

  const getStatusMessage = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "pending") return "Your feedback has been received and is awaiting review.";
    if (normalized === "in progress") return "We are actively working on your feedback.";
    if (normalized === "resolved") return "Your feedback has been addressed and resolved.";
    return "Your feedback is being processed.";
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (trackingId) {
    return (
      <div className="ff-page-shell flex items-center justify-center p-4">
        <Card className="ff-surface w-full max-w-lg shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <ArrowRight className="h-8 w-8 text-accent" />
            </div>
            <CardTitle>Feedback Submitted</CardTitle>
            <CardDescription>Your feedback has been received successfully.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="mb-2 text-sm text-muted-foreground">Your Tracking ID</p>
              <p className="text-2xl font-bold text-primary">{trackingId}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => void copyToClipboard(trackingId)}>
                Copy ID
              </Button>
              <Button className="flex-1 bg-accent hover:bg-accent/90" onClick={() => setTrackingId(null)}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="ff-page-shell">
      <div className="bg-accent text-accent-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">User Dashboard</h1>
              <p className="mt-1 text-accent-foreground/80">Welcome, {currentUser?.fullName}</p>
              <p className="mt-2 text-xs text-accent-foreground/70">{submissionCountLabel}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {isLoadingPage ? (
          <LoadingState label="Loading your dashboard..." />
        ) : loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => {
              if (currentUser?.id) {
                void loadInitialData(currentUser.id);
              }
            }}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-2xl font-bold">Submit Feedback</h2>
              <Card className="ff-surface shadow-lg">
                <CardHeader>
                  <CardTitle>Feedback Form</CardTitle>
                  <CardDescription>Submit securely and choose anonymous mode anytime.</CardDescription>
                </CardHeader>
                <CardContent>
                  {categories.length === 0 ? (
                    <EmptyState title="No categories available" message="Please contact admin to add categories." />
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                        <div className="flex items-center gap-3">
                          {isAnonymous ? (
                            <UserX className="h-5 w-5 text-accent" />
                          ) : (
                            <User className="h-5 w-5 text-accent" />
                          )}
                          <div>
                            <Label htmlFor="anonymous" className="cursor-pointer text-base">
                              Submit Anonymously
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {isAnonymous
                                ? "Your identity stays hidden from admins."
                                : "Your name will be visible to admins."}
                            </p>
                          </div>
                        </div>
                        <Switch id="anonymous" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="type">
                          Feedback Type <RequiredMark />
                        </Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value) => {
                            setFormData((current) => ({ ...current, type: value }));
                            setErrors((current) => ({ ...current, type: undefined }));
                          }}
                        >
                          <SelectTrigger id="type" aria-invalid={Boolean(errors.type)}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="suggestion">Suggestion</SelectItem>
                            <SelectItem value="complaint">Complaint</SelectItem>
                            <SelectItem value="inquiry">Inquiry</SelectItem>
                          </SelectContent>
                        </Select>
                        <FieldError message={errors.type} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category">
                          Category <RequiredMark />
                        </Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => {
                            setFormData((current) => ({ ...current, category: value }));
                            setErrors((current) => ({ ...current, category: undefined }));
                          }}
                        >
                          <SelectTrigger id="category" aria-invalid={Boolean(errors.category)}>
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
                        <FieldError message={errors.category} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subject">
                          Subject <RequiredMark />
                        </Label>
                        <Input
                          id="subject"
                          placeholder="Brief summary"
                          value={formData.subject}
                          onChange={(event) => {
                            setFormData((current) => ({ ...current, subject: event.target.value }));
                            setErrors((current) => ({ ...current, subject: undefined }));
                          }}
                          aria-invalid={Boolean(errors.subject)}
                        />
                        <FieldError message={errors.subject} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">
                          Message <RequiredMark />
                        </Label>
                        <Textarea
                          id="message"
                          rows={5}
                          placeholder="Provide detailed information..."
                          value={formData.message}
                          onChange={(event) => {
                            setFormData((current) => ({ ...current, message: event.target.value }));
                            setErrors((current) => ({ ...current, message: undefined }));
                          }}
                          aria-invalid={Boolean(errors.message)}
                        />
                        <FieldError message={errors.message} />
                      </div>

                      <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Submit Feedback
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="mb-4 text-2xl font-bold">Track Your Feedback</h2>

              <Card className="ff-surface mb-6 shadow-lg">
                <CardHeader>
                  <CardTitle>Enter Tracking ID</CardTitle>
                  <CardDescription>Search for your submitted feedback.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSearch} className="flex gap-3">
                    <Input
                      placeholder="e.g., FF-ABC123XYZ"
                      value={searchTrackingId}
                      onChange={(event) => setSearchTrackingId(event.target.value)}
                      required
                    />
                    <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={isSearching}>
                      {isSearching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      Search
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {selectedFeedback && (
                <div className="space-y-6">
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

                  <Card className="ff-surface shadow-lg">
                    <CardContent className="pt-6">
                      <div className="mb-6 flex items-start justify-between">
                        <h3 className="text-lg font-semibold">Status: {selectedFeedback.status}</h3>
                        <StatusBadge status={selectedFeedback.status} />
                      </div>

                      <div className="mb-8 flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                        <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                        <p className="text-sm">{getStatusMessage(selectedFeedback.status)}</p>
                      </div>

                      <div className="space-y-4">
                        {getStatusSteps(selectedFeedback.status).map((step, index) => (
                          <div key={step.name} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${step.completed ? "bg-green-500/20" : "bg-gray-200"}`}>
                                {step.completed ? (
                                  <CheckCircle className="h-5 w-5 text-green-700" />
                                ) : (
                                  <Circle className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                              {index < getStatusSteps(selectedFeedback.status).length - 1 && <div className="h-12 w-px bg-border" />}
                            </div>
                            <div className="flex-1 pb-4">
                              <p className="font-semibold">{step.name}</p>
                              {step.name === "Submitted" && (
                                <p className="text-sm text-muted-foreground">{formatDate(selectedFeedback.createdAt)}</p>
                              )}
                              {step.description && (
                                <p className="text-sm text-muted-foreground">{step.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="ff-surface shadow-lg">
                    <CardHeader>
                      <CardTitle>Feedback Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="mb-1 text-sm font-semibold text-muted-foreground">Type</p>
                        <p className="capitalize">{selectedFeedback.type}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-muted-foreground">Category</p>
                        <p>{selectedFeedback.category}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-muted-foreground">Priority</p>
                        <PriorityBadge priority={selectedFeedback.priority} />
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-muted-foreground">Subject</p>
                        <p className="font-semibold">{selectedFeedback.subject}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-muted-foreground">Message</p>
                        <p className="text-sm leading-relaxed">{selectedFeedback.message}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-muted-foreground">Last Updated</p>
                        <p className="text-sm">{formatDate(selectedFeedback.updatedAt)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedFeedback.response && (
                    <Card className="ff-surface border-blue-200 bg-blue-50/50 shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-900">
                          <MessageCircle className="h-5 w-5" />
                          Updates from Admin
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed text-blue-900/80">{selectedFeedback.response}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {!selectedFeedback && feedbacks.length > 0 && (
                <Card className="ff-surface shadow-lg">
                  <CardHeader>
                    <CardTitle>My Submissions</CardTitle>
                    <CardDescription>Latest entries from your account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {feedbacks.map((feedback) => (
                      <button
                        key={feedback.id}
                        type="button"
                        className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
                        onClick={() => void handleViewFeedback(feedback)}
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <p className="font-semibold">{feedback.subject}</p>
                          <StatusBadge status={feedback.status} />
                        </div>
                        <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{feedback.message}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-mono">{feedback.id}</span>
                          <span>{new Date(feedback.createdAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {!selectedFeedback && feedbacks.length === 0 && (
                <EmptyState
                  title="No submissions yet"
                  message="Submit your first feedback using the form on the left."
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
