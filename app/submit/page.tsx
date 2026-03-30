"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Send } from "lucide-react";
import { submitFeedback, moderateFeedback, listCategories, type Category } from "@/frontend/api";

interface FormData {
  type: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
  isAnonymous: boolean;
}

export default function Submit() {
  const [formData, setFormData] = useState<FormData>({
    type: "",
    category: "",
    priority: "Medium",
    subject: "",
    message: "",
    isAnonymous: false,
  });
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingModeration, setIsCheckingModeration] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [moderationNotice, setModerationNotice] = useState<{
    severity: "warning" | "offensive";
    message: string;
  } | null>(null);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => {
        toast.error("Failed to load categories.");
      });
  }, []);

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

  const submitFeedbackEntry = async () => {
    setIsLoading(true);
    try {
      const userId = localStorage.getItem("currentUserId") || "";
      const userName = localStorage.getItem("currentUserName") || "Guest User";

      const res = await submitFeedback({
        type: formData.type,
        category: formData.category,
        priority: formData.priority,
        subject: formData.subject,
        message: formData.message,
        userId,
        userName,
        isAnonymous: formData.isAnonymous,
      });

      setIsConfirmOpen(false);
      setTrackingId(res.data.id);
      toast.success("Feedback submitted successfully!");
      setModerationNotice(null);
      setFormData({ type: "", category: "", priority: "Medium", subject: "", message: "", isAnonymous: false });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setIsCheckingModeration(true);
    try {
      const moderationRes = await moderateFeedback({
        subject: formData.subject,
        message: formData.message,
      });

      const words = moderationRes.data.matched_words.join(", ");
      const detail = words ? ` Matched words: ${words}.` : "";
      const message = `${moderationRes.data.reason}${detail}`;

      if (moderationRes.data.severity === "offensive") {
        setModerationNotice({ severity: "offensive", message });
        toast.error(moderationRes.data.reason);
        return;
      }

      if (moderationRes.data.severity === "warning") {
        setModerationNotice({ severity: "warning", message });
        toast.warning(moderationRes.data.reason);
      } else {
        setModerationNotice(null);
      }
    } catch {
      setModerationNotice(null);
      // If moderation pre-check fails, let the user continue.
    } finally {
      setIsCheckingModeration(false);
    }

    setIsConfirmOpen(true);
  };

  if (trackingId) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-gradient-to-br from-white to-muted p-4">
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
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Your Tracking ID
              </p>
              <p className="text-2xl font-bold text-primary">{trackingId}</p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Please save this tracking ID to check the status of your
              submission.
            </p>
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
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted p-4 py-12">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-3">Submit Your Feedback</h1>
          <p className="text-muted-foreground">
            Help us improve by sharing your feedback, concerns, requests, and
            recommendations.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Feedback Form</CardTitle>
            <CardDescription>
              Submissions are recorded with submitter identity for transparency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {moderationNotice && (
                <Alert variant={moderationNotice.severity === "offensive" ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {moderationNotice.severity === "offensive"
                      ? "Offensive content detected"
                      : "Warning: Mild negativity detected"}
                  </AlertTitle>
                  <AlertDescription>{moderationNotice.message}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="type">Feedback Type *</Label>
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
                    <SelectItem value="suggestion">Suggestion</SelectItem>
                    <SelectItem value="inquiry">Inquiry</SelectItem>
                    <SelectItem value="concern">Concern</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="compliment">Compliment</SelectItem>
                    <SelectItem value="request">Request</SelectItem>
                    <SelectItem value="recommendation">Recommendation</SelectItem>
                    <SelectItem value="clarification">Clarification</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
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
                    {categories.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No categories available
                      </SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Severity Level *</Label>
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
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  placeholder="Brief summary of your feedback"
                  value={formData.subject}
                  onChange={(e) => {
                    if (moderationNotice) setModerationNotice(null);
                    setFormData({ ...formData, subject: e.target.value });
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Provide detailed information about your feedback..."
                  rows={6}
                  value={formData.message}
                  onChange={(e) => {
                    if (moderationNotice) setModerationNotice(null);
                    setFormData({ ...formData, message: e.target.value });
                  }}
                  required
                />
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="is-anonymous"
                  checked={formData.isAnonymous}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isAnonymous: checked === true })
                  }
                />
                <Label htmlFor="is-anonymous" className="text-sm text-muted-foreground leading-5">
                  Submit anonymously
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                size="lg"
                disabled={isLoading || isCheckingModeration}
              >
                <Send className="mr-2 h-4 w-4" />
                {isLoading ? "Submitting..." : isCheckingModeration ? "Checking content..." : "Submit Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Confirm Feedback Submission</DialogTitle>
              <DialogDescription>
                Review your details below before sending.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{formData.type || "-"}</p>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">{formData.category || "-"}</p>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <p className="text-muted-foreground">Severity Level</p>
                <p className="font-medium">{formData.priority || "-"}</p>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <p className="text-muted-foreground">Subject</p>
                <p className="font-medium">{formData.subject || "-"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Message</p>
                <div className="rounded-md border bg-muted/30 px-3 py-2 max-h-40 overflow-auto">
                  <p className="whitespace-pre-wrap break-all">{formData.message || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <p className="text-muted-foreground">Anonymous</p>
                <p className="font-medium">{formData.isAnonymous ? "Yes" : "No"}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-accent hover:bg-accent/90"
                onClick={submitFeedbackEntry}
                disabled={isLoading}
              >
                {isLoading ? "Submitting..." : "Confirm & Submit"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}