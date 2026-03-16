"use client";

import React, { useEffect, useState } from "react";
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
import { submitFeedback, listCategories, type Category } from "@/frontend/api";

interface FormData {
  type: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
}

export default function Submit() {
  const [formData, setFormData] = useState<FormData>({
    type: "",
    category: "",
    priority: "Medium",
    subject: "",
    message: "",
  });
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userId = localStorage.getItem("currentUserId") || "";
      const userName = localStorage.getItem("currentUserName") || "Anonymous";

      const res = await submitFeedback({
        type: formData.type,
        category: formData.category,
        priority: formData.priority,
        subject: formData.subject,
        message: formData.message,
        userId,
        userName,
        isAnonymous: true,
      });

      setTrackingId(res.data.id);
      toast.success("Feedback submitted successfully!");
      setFormData({ type: "", category: "", priority: "Medium", subject: "", message: "" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsLoading(false);
    }
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
            Help us improve by sharing your suggestions, complaints, and
            inquiries.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Feedback Form</CardTitle>
            <CardDescription>
              All submissions are anonymous and confidential
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  rows={6}
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
                disabled={isLoading}
              >
                <Send className="mr-2 h-4 w-4" />
                {isLoading ? "Submitting..." : "Submit Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}