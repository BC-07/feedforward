"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createFeedback, listCategories } from "@/lib/api";
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
import { toast } from "sonner";
import { ArrowRight, Copy, Send } from "lucide-react";
import { useDraftStorage } from "@/lib/useDraftStorage";
import { toastApiError } from "@/lib/errorHandling";
import { formatFeedbackText } from "@/lib/textFormat";

interface FormData {
  type: string;
  category: string;
  subject: string;
  message: string;
}

const FEEDBACK_MESSAGE_MAX_LENGTH = 250;
const FEEDBACK_SUBJECT_MAX_LENGTH = 50;

export default function Submit() {
  const router = useRouter();
  const draftKey = "ff:submitDraft";
  const {
    value: formData,
    setValue: setFormData,
    clear: clearDraft,
  } = useDraftStorage<FormData>(draftKey, {
    type: "",
    category: "",
    subject: "",
    message: "",
  });
  const userEmail =
    typeof window !== "undefined"
      ? localStorage.getItem("currentUserEmail") || ""
      : "";
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    void listCategories()
      .then((data) =>
        setCategories(
          data
            .map((category) => category.name)
            .filter((name) => {
              const normalized = name.toLowerCase();
              return normalized !== "disabled" && normalized !== "inactive";
            }),
        ),
      )
      .catch((error) => {
        toastApiError(error, "Failed to load categories.");
      });
  }, []);

  // Draft storage handled by useDraftStorage.

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    if (formData.message.trim().length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      toast.error(`Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or less.`);
      return;
    }

    const normalizedSubject = formatFeedbackText(formData.subject);
    const normalizedMessage = formatFeedbackText(formData.message);

    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;
    submitLockRef.current = true;
    setIsSubmittingFeedback(true);

    try {
      const userId =
        typeof window !== "undefined"
          ? localStorage.getItem("currentUserId")
          : null;
      const userName =
        typeof window !== "undefined"
          ? localStorage.getItem("currentUserName") || "Guest"
          : "Guest";

      await createFeedback({
        id: newTrackingId,
        ...formData,
        subject: normalizedSubject,
        message: normalizedMessage,
        userId,
        userName,
        userEmail: userEmail || undefined,
        status: "Pending",
        priority: "Medium",
        isAnonymous: true,
        response: "",
      });

      setTrackingId(newTrackingId);
      toast.success("Feedback submitted successfully!");
      setFormData({ type: "", category: "", subject: "", message: "" });
      clearDraft();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit feedback.";
      if (message.toLowerCase().includes("log in again")) {
        localStorage.removeItem("isUserLoggedIn");
        localStorage.removeItem("currentUserId");
        localStorage.removeItem("currentUserName");
        localStorage.removeItem("currentUserEmail");
        toast.error("Your session is no longer valid. Please log in again.");
        router.push("/login");
        return;
      }
      toast.error(
        message,
      );
    } finally {
      submitLockRef.current = false;
      setIsSubmittingFeedback(false);
    }
  };

  if (trackingId) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-gradient-to-br from-white to-muted px-4 py-8 sm:py-12">
        <Card className="max-w-lg w-full shadow-lg">
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
            <div className="bg-muted rounded-lg p-4 text-center relative">
              <p className="text-sm text-muted-foreground mb-2">
                Your Tracking ID
              </p>
              <p className="text-2xl font-bold text-primary">{trackingId}</p>
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
            {userEmail ? (
              <p className="text-xs text-muted-foreground text-center">
                A copy of this tracking ID was sent to {userEmail}.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Sign in to receive email updates when your feedback is resolved.
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 w-full"
                onClick={() =>
                  router.push(
                    `/track?trackingId=${encodeURIComponent(trackingId)}`,
                  )
                }
              >
                Track Submission
              </Button>
              <Button
                className="flex-1 w-full bg-accent hover:bg-accent/90"
                onClick={() => setTrackingId(null)}
              >
                Submit Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted px-4 py-8 sm:py-12">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">Submit Your Feedback</h1>
          <p className="text-muted-foreground">
            Help us improve by sharing your suggestions, complaints, and
            inquiries.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Feedback Form</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="type">Feedback Type *</Label>
                <Select
                  value={formData.type}
                  disabled={isSubmittingFeedback}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                  required
                >
                  <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suggestion">Suggestion</SelectItem>
                      <SelectItem value="complaint">Complaint</SelectItem>
                      <SelectItem value="inquiry">Inquiry</SelectItem>
                      <SelectItem value="request">Request</SelectItem>
                      <SelectItem value="compliment">Compliment</SelectItem>
                    </SelectContent>
                  </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  disabled={isSubmittingFeedback}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
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
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Provide detailed information about your feedback..."
                  rows={1}
                  className="ff-hide-scrollbar w-full max-w-full min-h-[2.5rem] overflow-hidden [field-sizing:content] [max-inline-size:100%] [overflow-wrap:anywhere] [word-break:break-word] [white-space:pre-wrap]"
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

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                size="lg"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
