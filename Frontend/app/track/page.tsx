"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createFeedbackMessage,
  getFeedback,
  listFeedbackMessages,
  type Feedback,
  type FeedbackMessage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Clock, CheckCircle, Circle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { parseAdminResponses } from "@/lib/responseLog";
import { formatLocalTime } from "@/lib/time";

export default function TrackFeedback() {
  const searchParams = useSearchParams();
  const [trackingId, setTrackingId] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [canReply, setCanReply] = useState(false);

  const normalizeTrackingId = (value: string) => value.trim().toUpperCase();
  const isValidTrackingId = (value: string) =>
    /^FF-[A-Z0-9]+$/.test(value) && value.length >= 6;

  const searchFeedback = async (id: string) => {
    try {
      const found = await getFeedback(id.trim());
      setFeedback(found);
      setNotFound(false);
    } catch {
      setFeedback(null);
      setNotFound(true);
      toast.error(
        "Tracking ID not found. Please use the ID provided by the system.",
      );
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeTrackingId(trackingId);
    if (!normalized) {
      toast.error("Please enter your tracking ID.");
      return;
    }
    if (!isValidTrackingId(normalized)) {
      setFeedback(null);
      setNotFound(false);
      toast.error(
        "Tracking ID not found. Please use the ID provided by the system.",
      );
      return;
    }
    setTrackingId(normalized);
    await searchFeedback(normalized);
  };

  useEffect(() => {
    const param = searchParams.get("trackingId");
    if (!param) return;
    const normalized = normalizeTrackingId(param);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrackingId(normalized);
    if (!isValidTrackingId(normalized)) {
      setFeedback(null);
      setNotFound(false);
      toast.error(
        "Tracking ID not found. Please use the ID provided by the system.",
      );
      return;
    }
    void searchFeedback(normalized);
  }, [searchParams]);

  useEffect(() => {
    if (!feedback) {
      setMessages([]);
      setMessageDraft("");
      setCanReply(false);
      return;
    }

    if (typeof window !== "undefined") {
      const isLoggedIn =
        localStorage.getItem("isUserLoggedIn") === "true";
      const currentUserId = localStorage.getItem("currentUserId") || "";
      const feedbackUserId = feedback.userId || "";
      const canReplyLoggedIn =
        Boolean(isLoggedIn && feedbackUserId && currentUserId) &&
        feedbackUserId === currentUserId;
      const canReplyAnonymous =
        feedback.isAnonymous || !feedbackUserId;
      setCanReply(canReplyLoggedIn || canReplyAnonymous);
    }

    setIsLoadingMessages(true);
    listFeedbackMessages(feedback.id)
      .then((data) => {
        if (data.length > 0) {
          setMessages(data);
          return;
        }
        if (feedback.response) {
          const legacy = parseAdminResponses(feedback.response).map(
            (entry, index) => ({
              id: `legacy-${feedback.id}-${index}`,
              feedbackId: feedback.id,
              senderRole: "admin" as const,
              senderId: null,
              senderName: entry.author || "Admin",
              message: entry.message,
              createdAt: entry.time
                ? new Date(entry.time).toISOString()
                : feedback.updatedAt,
            }),
          );
          setMessages(legacy);
          return;
        }
        setMessages([]);
      })
      .catch(() => {
        setMessages([]);
      })
      .finally(() => {
        setIsLoadingMessages(false);
      });
  }, [feedback]);

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

  const handleSendMessage = async () => {
    if (!feedback) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) {
      toast.error("Please enter a message.");
      return;
    }
    setIsSendingMessage(true);
    try {
      const created = await createFeedbackMessage(feedback.id, {
        message: trimmed,
      });
      setMessages((prev) => [...prev, created]);
      setMessageDraft("");
    } catch {
      toast.error("Failed to send your message.");
    } finally {
      setIsSendingMessage(false);
    }
  };

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

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted px-4 py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">Track Your Submission</h1>
          <p className="text-muted-foreground">
            Enter your tracking ID to check the status of your feedback
          </p>
        </div>

        <Card className="shadow-lg mb-6">
          <CardHeader>
            <CardTitle>Enter Tracking ID</CardTitle>
            <CardDescription>Your tracking ID was provided when you submitted feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="tracking-id" className="sr-only">
                  Tracking ID
                </Label>
                <Input
                  id="tracking-id"
                  placeholder="e.g., FF-ABC123XYZ"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="bg-accent hover:bg-accent/90 sm:w-auto w-full">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {notFound && (
          <Card className="shadow-lg border-destructive/50">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Search className="h-8 w-8 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Feedback Not Found</h3>
                <p className="text-muted-foreground">
                  No feedback was found with tracking ID: <strong>{trackingId}</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please use the tracking ID provided by the system.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {feedback && (
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">
                      Status: <span className="uppercase">{feedback.status}</span>
                    </h3>
                  </div>
                  <Badge className={getStatusColor(feedback.status)} variant="outline">
                    {feedback.status.toLowerCase()}
                  </Badge>
                </div>

                <div className="flex items-start gap-3 mb-8 p-4 bg-muted/50 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{getStatusMessage(feedback.status)}</p>
                </div>

                {/* Status Timeline */}
                <div className="space-y-4">
                  {getStatusSteps(feedback.status).map((step, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            step.completed ? "bg-green-500/20" : "bg-gray-200"
                          }`}
                        >
                          {step.completed ? (
                            <CheckCircle className="h-5 w-5 text-green-700" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        {index < getStatusSteps(feedback.status).length - 1 && (
                          <div className="h-12 w-px bg-border"></div>
                        )}
                      </div>
                      <div className="pb-4 flex-1">
                        <p className="font-semibold">{step.name}</p>
                        {step.name === "Submitted" && (
                          <p className="text-sm text-muted-foreground">
                            {formatDate(feedback.createdAt)}
                          </p>
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

            {/* Feedback Details Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Your Feedback Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Type</p>
                  <p className="capitalize">{feedback.type}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Category</p>
                  <p>{feedback.category}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Priority</p>
                  <p className={`capitalize ${getPriorityColor(feedback.priority)}`}>
                    {feedback.priority}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Subject</p>
                  <p className="font-semibold">{feedback.subject}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Message</p>
                  <p className="text-sm leading-relaxed">{feedback.message}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Last Updated</p>
                  <p className="text-sm">{formatDate(feedback.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Conversation */}
            <Card className="shadow-lg bg-muted/40 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <MessageCircle className="h-5 w-5" />
                  Conversation
                </CardTitle>
                <CardDescription>
                  {canReply
                    ? "Reply to the admin team about this submission."
                    : "Log in to reply to this submission."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-[340px] overflow-y-auto rounded-lg border border-border bg-white/70 p-4">
                  {isLoadingMessages && (
                    <p className="text-sm text-muted-foreground">
                      Loading conversation...
                    </p>
                  )}
                  {!isLoadingMessages && messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No messages yet. Updates from the admin team will appear here.
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
                        ? createdAt.toDateString() === today.toDateString()
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
                      const name = isUser ? "You" : entry.senderName || "Admin";
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
                              className={`max-w-[75%] rounded-lg px-4 py-3 text-sm shadow-sm ${
                                isUser
                                  ? "bg-accent text-white"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              <p className="text-[11px] font-semibold opacity-80">
                                {name}{" "}
                                {entry.createdAt && (
                                  <span className="font-normal">
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
                )}
              </CardContent>
            </Card>

            {/* Footer Message */}
            <Card className="shadow-lg bg-muted/30 border-muted">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Thank you for submitting your feedback. We appreciate your contribution to improving our
                    services. Save your tracking ID to check for updates later.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}


