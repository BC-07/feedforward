"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFeedback, listCategories } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ux/async-state";
import { FieldError, RequiredMark } from "@/components/ux/form-feedback";

interface FormData {
  type: string;
  category: string;
  subject: string;
  message: string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

export default function Submit() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    type: "",
    category: "",
    subject: "",
    message: "",
  });
<<<<<<< HEAD
  const [errors, setErrors] = useState<FormErrors>({});
=======
  const userEmail =
    typeof window !== "undefined"
      ? localStorage.getItem("currentUserEmail") || ""
      : "";
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCategories = async () => {
    setIsLoadingCategories(true);
    setCategoriesError("");
    try {
      const data = await listCategories();
      const names = data.map((category) => category.name);
      setCategories(names);
    } catch (error) {
      setCategoriesError(error instanceof Error ? error.message : "Failed to load categories.");
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

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
      toast.error("Failed to copy. Please copy it manually.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;

    try {
      const userId = typeof window !== "undefined" ? localStorage.getItem("currentUserId") : null;
      const userName =
        typeof window !== "undefined"
          ? localStorage.getItem("currentUserName") || "Anonymous"
          : "Anonymous";

      await createFeedback({
        id: newTrackingId,
        ...formData,
        userId,
        userName,
        userEmail: userEmail || undefined,
        isAnonymous: !userId,
        status: "Pending",
        priority: "Medium",
        response: "",
      });

      setTrackingId(newTrackingId);
      setFormData({ type: "", category: "", subject: "", message: "" });
      setErrors({});
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

  if (trackingId) {
    return (
      <div className="ff-page-shell flex items-center justify-center p-4">
        <Card className="ff-surface w-full max-w-lg shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <ArrowRight className="h-8 w-8 text-accent" />
            </div>
            <CardTitle>Feedback Submitted</CardTitle>
            <CardDescription>Your feedback has been received.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="mb-2 text-sm text-muted-foreground">Your Tracking ID</p>
              <p className="text-2xl font-bold text-primary">{trackingId}</p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Save this ID so you can track your submission later.
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
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => void copyToClipboard(trackingId)}>
                Copy ID
              </Button>
              <Button className="flex-1 bg-accent hover:bg-accent/90" onClick={() => setTrackingId(null)}>
                Submit Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="ff-page-shell p-4 py-12">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Submit Your Feedback</h1>
          <p className="mt-2 text-muted-foreground">
            Share suggestions, complaints, or inquiries securely.
          </p>
        </div>

        <Card className="ff-surface shadow-lg">
          <CardHeader>
            <CardTitle>Feedback Form</CardTitle>
<<<<<<< HEAD
            <CardDescription>All submissions are treated confidentially.</CardDescription>
=======
            <CardDescription>
              All submissions are anonymous and confidential. If you are signed
              in, we will email your tracking ID and resolution updates.
            </CardDescription>
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be
          </CardHeader>
          <CardContent>
            {isLoadingCategories ? (
              <LoadingState label="Loading categories..." />
            ) : categoriesError ? (
              <ErrorState message={categoriesError} onRetry={() => void loadCategories()} />
            ) : categories.length === 0 ? (
              <EmptyState title="No categories available" message="Please contact admin to add categories first." />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
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
                    placeholder="Brief summary of your feedback"
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
                    placeholder="Provide detailed information..."
                    rows={6}
                    value={formData.message}
                    onChange={(event) => {
                      setFormData((current) => ({ ...current, message: event.target.value }));
                      setErrors((current) => ({ ...current, message: undefined }));
                    }}
                    aria-invalid={Boolean(errors.message)}
                  />
                  <FieldError message={errors.message} />
                </div>

                <Button type="submit" className="w-full bg-accent hover:bg-accent/90" size="lg" disabled={isSubmitting}>
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
    </div>
  );
}

