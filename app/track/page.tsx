"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Clock, CheckCircle, Circle, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Feedback {
  id: string;
  type: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  response?: string;
}

export default function TrackFeedback() {
  const [trackingId, setTrackingId] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const feedbacks = JSON.parse(localStorage.getItem("feedbacks") || "[]");
    const found = feedbacks.find((f: Feedback) => f.id === trackingId.trim());
    
    if (found) {
      setFeedback(found);
      setNotFound(false);
    } else {
      setFeedback(null);
      setNotFound(true);
      toast.error("Feedback not found. Please check your tracking ID.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "under review":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "in progress":
        return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      case "resolved":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "closed":
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
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
      case "urgent":
        return "text-red-600";
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

  const getStatusMessage = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "Your feedback has been received and is awaiting review.";
      case "under review":
        return "Your feedback is being assessed by our team.";
      case "in progress":
        return "We are actively working on addressing your feedback.";
      case "resolved":
        return "Your feedback has been addressed and resolved.";
      case "closed":
        return "This feedback has been closed.";
      default:
        return "Your feedback is being processed.";
    }
  };

  const getStatusSteps = (currentStatus: string) => {
    const steps = [
      { name: "Submitted", description: "", completed: true },
      { name: "Under Review", description: "Being assessed by our team", completed: false },
      { name: "In Progress", description: "Actions being taken", completed: false },
      { name: "Resolved", description: "Issue addressed", completed: false },
    ];

    const statusOrder = ["pending", "under review", "in progress", "resolved", "closed"];
    const currentIndex = statusOrder.indexOf(currentStatus.toLowerCase());

    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
    }));
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted p-4 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-3">Track Your Submission</h1>
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
            <form onSubmit={handleSearch} className="flex gap-3">
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
              <Button type="submit" className="bg-accent hover:bg-accent/90">
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
                  Please check your tracking ID and try again.
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

            {/* Admin Response Card */}
            {feedback.response && (
              <Card className="shadow-lg bg-blue-50/50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900">
                    <MessageCircle className="h-5 w-5" />
                    Updates from Admin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-900/80 leading-relaxed">{feedback.response}</p>
                </CardContent>
              </Card>
            )}

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
