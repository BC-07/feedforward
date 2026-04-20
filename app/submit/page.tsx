"use client";

import React, { useEffect, useState } from "react";
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
import { ArrowRight, Send } from "lucide-react";
import { useDraftStorage } from "@/lib/useDraftStorage";
import { toastApiError } from "@/lib/errorHandling";

interface FormData {
  type: string;
  category: string;
  subject: string;
  message: string;
}

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

    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;

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
                onClick={() => copyToClipboard(trackingId)}
              >
                Copy ID
              </Button>
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

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                size="lg"
              >
                <Send className="mr-2 h-4 w-4" />
                Submit Feedback
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}