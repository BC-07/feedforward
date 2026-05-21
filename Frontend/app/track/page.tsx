"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createFeedbackMessagePublic,
  getFeedbackPublic,
  listFeedbackMessages,
  type Feedback,
  type FeedbackMessage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MessageCircle, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { parseAdminResponses } from "@/lib/responseLog";
import { formatLocalTime } from "@/lib/time";
import {
  CONVERSATION_MESSAGE_MAX_LENGTH,
  USER_MESSAGE_BUBBLE_CLASS,
} from "@/components/user/constants";

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
  const [activeTab, setActiveTab] = useState<"details" | "messages">("details");
  const [tabAnimDirection, setTabAnimDirection] = useState<"left" | "right">("left");
  const previousTabRef = useRef<"details" | "messages">("details");
  const conversationScrollRef = useRef<HTMLDivElement>(null);

  const sameMessageList = (a: FeedbackMessage[], b: FeedbackMessage[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (
        a[i].id !== b[i].id ||
        a[i].senderRole !== b[i].senderRole ||
        a[i].message !== b[i].message ||
        a[i].createdAt !== b[i].createdAt
      ) {
        return false;
      }
    }
    return true;
  };

  const normalizeTrackingId = (value: string) => value.trim().toUpperCase();
  const isValidTrackingId = (value: string) =>
    /^FF-[A-Z0-9]+$/.test(value) && value.length >= 6;
  const isAccountOwnedFeedback = !!feedback?.userId?.trim();

  const searchFeedback = async (id: string) => {
    try {
      const found = await getFeedbackPublic(id.trim());
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
      setActiveTab("details");
      previousTabRef.current = "details";
      return;
    }

    // Account-owned submissions are view-only in public tracking.
    setCanReply(!isAccountOwnedFeedback);

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
  }, [feedback, isAccountOwnedFeedback]);

  useEffect(() => {
    if (!feedback?.id) return;
    const intervalId = window.setInterval(() => {
      void listFeedbackMessages(feedback.id)
        .then((data) => {
          if (data.length === 0) return;
          setMessages((prev) => (sameMessageList(prev, data) ? prev : data));
        })
        .catch(() => {
          // Keep existing messages if refresh fails.
        });
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [feedback?.id]);

  useEffect(() => {
    const container = conversationScrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
    });
  }, [messages.length, isLoadingMessages, activeTab]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSendMessage = async () => {
    if (!feedback) return;
    if (!canReply) {
      toast.error(
        "Messaging is disabled here for account-owned submissions. Please sign in to reply.",
      );
      return;
    }
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
            <Card className="shadow-lg border-border">
              <CardContent className="pt-6">
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => {
                    const next = value as "details" | "messages";
                    const tabOrder: Array<"details" | "messages"> = ["details", "messages"];
                    const prevIdx = tabOrder.indexOf(previousTabRef.current);
                    const nextIdx = tabOrder.indexOf(next);
                    setTabAnimDirection(nextIdx > prevIdx ? "left" : "right");
                    previousTabRef.current = next;
                    setActiveTab(next);
                  }}
                  className="flex min-h-0 w-full flex-1 flex-col gap-3"
                >
                  <TabsList className="mx-auto grid w-full max-w-[440px] grid-cols-2 rounded-full">
                    <TabsTrigger value="details" className="data-[state=inactive]:text-muted-foreground data-[state=active]:text-foreground">
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="data-[state=inactive]:text-muted-foreground data-[state=active]:text-foreground">
                      Messages
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="mt-0 space-y-3">
                    <div
                      key={`track-details-tab-${activeTab}`}
                      className={tabAnimDirection === "left" ? "ff-step-slide-in-left" : "ff-step-slide-in-right"}
                    >
                      <div className="rounded-[12px] border border-border bg-muted/20 px-5 py-4">
                        <p className="mb-2 text-[0.85rem] tracking-[0.04em] text-foreground">
                          Feedback details: <span className="text-muted-foreground">{feedback.id}</span>
                        </p>
                        <div className="mb-2 flex items-center justify-between gap-3 border-b border-border pb-2">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4 text-muted-foreground" />
                            <p className="text-[1.05rem] font-medium leading-tight text-foreground">{feedback.subject}</p>
                          </div>
                          <span className="rounded-full border border-amber-300 bg-transparent px-3 py-[0.12rem] text-[0.85rem] font-medium capitalize text-amber-600">
                            {feedback.priority}
                          </span>
                        </div>

                        <div className="divide-y divide-border text-[0.95rem]">
                          <div className="grid grid-cols-[4.7rem_minmax(0,1fr)] gap-4 py-1.5">
                            <p className="text-muted-foreground">Type</p>
                            <p className="text-foreground capitalize">{feedback.type}</p>
                          </div>
                          <div className="grid grid-cols-[4.7rem_minmax(0,1fr)] gap-4 py-1.5">
                            <p className="text-muted-foreground">Category</p>
                            <p className="text-foreground">{feedback.category}</p>
                          </div>
                          <div className="grid grid-cols-[4.7rem_minmax(0,1fr)] gap-4 py-1.5">
                            <p className="text-muted-foreground">Updated</p>
                            <p className="text-foreground">{formatDate(feedback.updatedAt)}</p>
                          </div>
                          <div className="grid grid-cols-[4.7rem_minmax(0,1fr)] gap-4 py-1.5">
                            <p className="text-muted-foreground">Details</p>
                            <p className="italic text-muted-foreground">{feedback.message}</p>
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const normalizedStatus = feedback.status.trim().toLowerCase();
                        const currentIndex = ["pending", "in progress", "resolved"].indexOf(normalizedStatus);
                        const safeIndex = Math.max(currentIndex, 0);
                        const isPending = safeIndex === 0;
                        const isInProgress = safeIndex === 1;
                        const isResolved = safeIndex === 2;
                        const statusDotClass = isResolved
                          ? "bg-emerald-600"
                          : isInProgress
                            ? "bg-blue-500"
                            : "bg-amber-500";
                        const statusTextClass = isResolved
                          ? "text-emerald-600"
                          : isInProgress
                            ? "text-blue-600"
                            : "text-amber-600";

                        return (
                          <div className="mt-3">
                            <div className="mb-3 flex items-center gap-3">
                              <div className="relative h-[4px] flex-1 rounded-full bg-muted">
                                <div
                                  className="absolute left-0 top-0 h-[4px] rounded-full bg-amber-500"
                                  style={{
                                    width: isPending ? "33.333%" : isInProgress ? "66.666%" : "100%",
                                  }}
                                />
                              </div>
                              <p className="text-sm tracking-[0.08em] text-muted-foreground uppercase">
                                {normalizedStatus === "in progress" ? "In progress" : normalizedStatus}
                              </p>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div className="space-y-1">
                                <div className={`mx-auto h-2.5 w-2.5 rounded-full ${isPending || isInProgress || isResolved ? "bg-amber-500" : "bg-muted"}`} />
                                <p className={`text-[0.9rem] ${isPending || isInProgress || isResolved ? "text-amber-600" : "text-muted-foreground"}`}>Submitted</p>
                              </div>
                              <div className="space-y-1">
                                <div className={`mx-auto h-2.5 w-2.5 rounded-full ${isInProgress || isResolved ? "bg-blue-500" : "bg-muted"}`} />
                                <p className={`text-[0.9rem] ${isInProgress || isResolved ? "text-blue-600" : "text-muted-foreground"}`}>In progress</p>
                              </div>
                              <div className="space-y-1">
                                <div className={`mx-auto h-2.5 w-2.5 rounded-full ${isResolved ? "bg-emerald-600" : "bg-muted"}`} />
                                <p className={`text-[0.9rem] ${isResolved ? "text-emerald-600" : "text-muted-foreground"}`}>Resolved</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </TabsContent>

                  <TabsContent value="messages" className="mt-0 flex min-h-0 flex-1 flex-col">
                    <div
                      key={`track-messages-tab-${activeTab}`}
                      className={`flex min-h-0 flex-1 flex-col ${tabAnimDirection === "left" ? "ff-step-slide-in-left" : "ff-step-slide-in-right"}`}
                    >
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted/20">
                        {!canReply ? (
                          <div className="border-b border-border bg-amber-50/80 px-3 py-2">
                            <p className="flex items-center gap-2 text-xs text-amber-700">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              This is an account-owned submission. Messaging is disabled on public tracking.
                            </p>
                          </div>
                        ) : null}
                        <div
                          ref={conversationScrollRef}
                          className="ff-hide-scrollbar min-h-0 flex-1 overflow-y-auto p-3"
                        >
                          {isLoadingMessages ? (
                            <div className="flex h-full items-center justify-center">
                              <p className="text-sm text-muted-foreground">Loading conversation...</p>
                            </div>
                          ) : null}
                          {!isLoadingMessages && messages.length === 0 ? (
                            <div className="flex h-full items-center justify-center">
                              <div className="text-center">
                                <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                                <p className="text-sm text-muted-foreground">
                                  No messages yet
                                </p>
                                <p className="text-xs text-muted-foreground/60">
                                  {canReply
                                    ? "Send a message to start the conversation"
                                    : "Sign in to the linked account to reply"}
                                </p>
                              </div>
                            </div>
                          ) : null}
                          <div className="space-y-3">
                            {(() => {
                              let lastDayLabel = "";
                              return messages.map((entry, index, allMessages) => {
                                const createdAt = entry.createdAt ? new Date(entry.createdAt) : null;
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
                                  (entry.message || "").length > 60;
                                return (
                                  <div key={`msg-${entry.id}`} className="space-y-2">
                                    {showDayLabel ? (
                                      <div className="flex items-center gap-2 py-1">
                                        <div className="h-px flex-1 bg-border/60" />
                                        <span className="text-[10px] font-normal text-muted-foreground">{dayLabel}</span>
                                        <div className="h-px flex-1 bg-border/60" />
                                      </div>
                                    ) : null}
                                    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                                      <div className={`group relative w-fit min-w-0 max-w-[85%] ${isUser ? "text-right" : "text-left"}`}>
                                        {showName && !isUser ? (
                                          <p className="mb-1 px-1 text-[11px] font-normal text-muted-foreground">{name}</p>
                                        ) : null}
                                        <div
                                          className={`rounded-2xl px-3 py-2 text-sm ${
                                            isUser
                                              ? USER_MESSAGE_BUBBLE_CLASS
                                              : "border border-border bg-background text-foreground"
                                          }`}
                                        >
                                          <p className={`whitespace-pre-line break-words leading-relaxed ${isUser ? "!text-white" : ""}`}>
                                            {entry.message}
                                          </p>
                                        </div>
                                        {entry.createdAt && (
                                          <span
                                            className={`pointer-events-none absolute z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-black/50 px-2.5 py-1 text-[10px] text-white shadow-sm group-hover:inline-flex ${
                                              isUser ? "-left-1 -translate-x-full" : "-right-1 translate-x-full"
                                            } ${
                                              isLikelyMultiLine ? "top-1/2" : "top-[68%]"
                                            }`}
                                          >
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
                        {canReply && (
                          <div className="border-t border-border bg-background/90 p-2">
                            <div className="flex items-end gap-2">
                              <Textarea
                                id="reply-message"
                                placeholder="Type your message..."
                                rows={1}
                                value={messageDraft}
                                onChange={(e) =>
                                  setMessageDraft(
                                    e.target.value.slice(0, CONVERSATION_MESSAGE_MAX_LENGTH),
                                  )
                                }
                                maxLength={CONVERSATION_MESSAGE_MAX_LENGTH}
                                disabled={isSendingMessage}
                                className="ff-hide-scrollbar w-full max-w-full min-w-0 max-h-[8rem] min-h-8 resize-none overflow-y-auto rounded-lg border border-border/70 bg-background px-3 py-2 text-xs leading-relaxed [field-sizing:fixed] [max-inline-size:100%] [overflow-wrap:anywhere] [word-break:break-word] [white-space:pre-wrap]"
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
                                aria-label="Send message"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
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
