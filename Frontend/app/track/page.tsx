"use client";
<<<<<<< HEAD

import { useState } from "react";
=======
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be
import { getFeedback, type Feedback } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Clock, CheckCircle, Circle, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PriorityBadge, StatusBadge } from "@/components/ux/badges";

export default function TrackFeedback() {
  const searchParams = useSearchParams();
  const [trackingId, setTrackingId] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

<<<<<<< HEAD
  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trackingId.trim()) {
      toast.error("Tracking ID is required.");
      return;
    }

    setIsSearching(true);
=======
  const searchFeedback = async (id: string) => {
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be
    try {
      const found = await getFeedback(id.trim());
      setFeedback(found);
      setNotFound(false);
    } catch {
      setFeedback(null);
      setNotFound(true);
      toast.error("Feedback not found. Please check your tracking ID.");
    } finally {
      setIsSearching(false);
    }
  };

<<<<<<< HEAD
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
=======
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await searchFeedback(trackingId);
  };

  useEffect(() => {
    const param = searchParams.get("trackingId");
    if (!param) return;
    setTrackingId(param);
    void searchFeedback(param);
  }, [searchParams]);

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
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getStatusMessage = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "pending") return "Your feedback has been received and is awaiting review.";
    if (normalized === "in progress") return "We are actively working on your feedback.";
    if (normalized === "resolved") return "Your feedback has been addressed and resolved.";
    return "Your feedback is being processed.";
  };

  const getStatusSteps = (currentStatus: string) => {
    const steps = [
      { name: "Submitted", description: "" },
      { name: "In Progress", description: "Actions being taken" },
      { name: "Resolved", description: "Issue addressed" },
    ];
    const statusOrder = ["pending", "in progress", "resolved"];
    const currentIndex = statusOrder.indexOf(currentStatus.toLowerCase());

    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
    }));
  };

  return (
    <div className="ff-page-shell p-4 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Track Your Submission</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your tracking ID to check feedback status.
          </p>
        </div>

        <Card className="ff-surface mb-6 shadow-lg">
          <CardHeader>
            <CardTitle>Enter Tracking ID</CardTitle>
            <CardDescription>Your tracking ID was provided after feedback submission.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="tracking-id" className="sr-only">
                  Tracking ID
                </Label>
                <Input
                  id="tracking-id"
                  placeholder="e.g., FF-ABC123XYZ"
                  value={trackingId}
                  onChange={(event) => setTrackingId(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={isSearching}>
                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {notFound && (
          <Card className="ff-surface border-destructive/50 shadow-lg">
            <CardContent className="pt-6">
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <Search className="h-8 w-8 text-destructive" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Feedback Not Found</h3>
                <p className="text-muted-foreground">
                  No feedback was found with tracking ID: <strong>{trackingId}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {feedback && (
          <div className="space-y-6">
            <Card className="ff-surface shadow-lg">
              <CardContent className="pt-6">
                <div className="mb-6 flex items-start justify-between">
                  <h3 className="text-lg font-semibold">Status: {feedback.status}</h3>
                  <StatusBadge status={feedback.status} />
                </div>

                <div className="mb-8 flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                  <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <p className="text-sm">{getStatusMessage(feedback.status)}</p>
                </div>

                <div className="space-y-4">
                  {getStatusSteps(feedback.status).map((step, index) => (
                    <div key={step.name} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${step.completed ? "bg-green-500/20" : "bg-gray-200"}`}>
                          {step.completed ? (
                            <CheckCircle className="h-5 w-5 text-green-700" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        {index < getStatusSteps(feedback.status).length - 1 && <div className="h-12 w-px bg-border" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-semibold">{step.name}</p>
                        {step.name === "Submitted" && (
                          <p className="text-sm text-muted-foreground">{formatDate(feedback.createdAt)}</p>
                        )}
                        {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="ff-surface shadow-lg">
              <CardHeader>
                <CardTitle>Your Feedback Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-sm font-semibold text-muted-foreground">Type</p>
                  <p className="capitalize">{feedback.type}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-muted-foreground">Category</p>
                  <p>{feedback.category}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-muted-foreground">Priority</p>
                  <PriorityBadge priority={feedback.priority} />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-muted-foreground">Subject</p>
                  <p className="font-semibold">{feedback.subject}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-muted-foreground">Message</p>
                  <p className="text-sm leading-relaxed">{feedback.message}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-muted-foreground">Last Updated</p>
                  <p className="text-sm">{formatDate(feedback.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>

            {feedback.response && (
              <Card className="ff-surface border-blue-200 bg-blue-50/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900">
                    <MessageCircle className="h-5 w-5" />
                    Updates from Admin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-blue-900/80">{feedback.response}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

