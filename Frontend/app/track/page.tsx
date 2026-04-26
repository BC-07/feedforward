"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createFeedbackMessagePublic,
  getFeedback,
  listFeedbackMessages,
  type Feedback,
  type FeedbackMessage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { parseAdminResponses } from "@/lib/responseLog";
import { formatLocalTime } from "@/lib/time";
import { FeedbackDetailsCard } from "@/components/feedback/FeedbackDetailsCard";
import { FeedbackStatusCard } from "@/components/feedback/FeedbackStatusCard";

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

    // Track page is intentionally "ID-based": anyone with a valid tracking ID
    // can continue the conversation, even without an active account session.
    setCanReply(true);

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
      const created = await createFeedbackMessagePublic(feedback.id, {
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

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white via-orange-50 to-white px-4 py-8 sm:py-12">
      <div className="container mx-auto max-w-4xl">
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <FeedbackStatusCard
                feedback={feedback}
                formatDate={formatDate}
                className="lg:col-span-6 h-full"
              />

              {/* Feedback Details Card */}
              <div className="lg:col-span-6">
                <FeedbackDetailsCard
                  feedback={feedback}
                  title="Your Feedback Details"
                  formatDate={formatDate}
                  className="h-full"
                />
              </div>
            </div>

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
                    return messages.map((entry, index, allMessages) => {
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
                      const hasVeryLongToken = /\S{24,}/.test(entry.message || "");
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
                                  {formatAdminTime(entry.createdAt)}
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
              {canReply && (
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
