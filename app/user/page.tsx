"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowRight,
  Send,
  LogOut,
  Search,
  Clock,
  CheckCircle,
  Circle,
  MessageCircle,
  User,
  UserX,
  ChevronLeft,
} from "lucide-react";

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
  userId: string;
}

export default function UserProfile() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [searchTrackingId, setSearchTrackingId] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [formData, setFormData] = useState({
    type: "",
    category: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("isUserLoggedIn");
    const userId = localStorage.getItem("currentUserId");

    if (!isLoggedIn || !userId) {
      router.push("/login");
      return;
    }

    const user = {
      id: userId,
      fullName: localStorage.getItem("currentUserName") || "",
      name: localStorage.getItem("currentUserName") || "",
      email: localStorage.getItem("currentUserEmail") || "",
      school: localStorage.getItem("currentUserSchool") || "",
      department: localStorage.getItem("currentUserDepartment") || "",
    };
    setCurrentUser(user);
    loadUserFeedbacks(userId);
  }, [router]);

  const loadUserFeedbacks = (userId: string) => {
    const allFeedbacks = JSON.parse(localStorage.getItem("feedbacks") || "[]");
    const userFeedbacks = allFeedbacks.filter((f: Feedback) => f.userId === userId);
    setFeedbacks(userFeedbacks);
  };

  const handleLogout = () => {
    localStorage.removeItem("isUserLoggedIn");
    localStorage.removeItem("currentUserId");
    localStorage.removeItem("currentUserName");
    localStorage.removeItem("currentUserEmail");
    localStorage.removeItem("currentUserSchool");
    localStorage.removeItem("currentUserDepartment");
    toast.success("Logged out successfully");
    router.push("/login");
  };

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
    } catch (err) {
      toast.error("Failed to copy. Please copy manually.");
    }
    document.body.removeChild(textArea);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const newTrackingId = `FF-${Date.now().toString(36).toUpperCase()}`;
    const allFeedbacks = JSON.parse(localStorage.getItem("feedbacks") || "[]");
    const newFeedback = {
      id: newTrackingId,
      ...formData,
      status: "Pending",
      priority: "Medium",
      isAnonymous,
      userId: currentUser.id,
      submittedBy: isAnonymous ? "Anonymous" : currentUser.fullName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    allFeedbacks.push(newFeedback);
    localStorage.setItem("feedbacks", JSON.stringify(allFeedbacks));

    setTrackingId(newTrackingId);
    loadUserFeedbacks(currentUser.id);
    toast.success("Feedback submitted successfully!");
    setFormData({ type: "", category: "", subject: "", message: "" });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const found = feedbacks.find((f) => f.id === searchTrackingId.trim());
    if (found) {
      setSelectedFeedback(found);
      toast.success("Feedback found!");
    } else {
      setSelectedFeedback(null);
      toast.error("Feedback not found. Please check your tracking ID.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "under review": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "in progress": return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      case "resolved": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "closed": return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "low": return "text-gray-600";
      case "medium": return "text-yellow-600";
      case "high": return "text-orange-600";
      case "urgent": return "text-red-600";
      default: return "text-gray-600";
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
      case "pending": return "Your feedback has been received and is awaiting review.";
      case "under review": return "Your feedback is being assessed by our team.";
      case "in progress": return "We are actively working on addressing your feedback.";
      case "resolved": return "Your feedback has been addressed and resolved.";
      case "closed": return "This feedback has been closed.";
      default: return "Your feedback is being processed.";
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
    return steps.map((step, index) => ({ ...step, completed: index <= currentIndex }));
  };

  if (trackingId) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted">
        <div className="bg-accent text-accent-foreground">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">User Dashboard</h1>
                <p className="text-accent-foreground/80 mt-1">Welcome, {currentUser?.fullName}</p>
              </div>
              <Button variant="secondary" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-lg mx-auto">
            <Card className="shadow-lg">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <ArrowRight className="h-8 w-8 text-accent" />
                </div>
                <CardTitle>Feedback Submitted!</CardTitle>
                <CardDescription>Your feedback has been received successfully</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Your Tracking ID</p>
                  <p className="text-2xl font-bold text-primary">{trackingId}</p>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Please save this tracking ID to check the status of your submission.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => copyToClipboard(trackingId)}>
                    Copy ID
                  </Button>
                  <Button
                    className="flex-1 bg-accent hover:bg-accent/90"
                    onClick={() => {
                      setTrackingId(null);
                      setSelectedFeedback(null);
                    }}
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted">
      <div className="bg-accent text-accent-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">User Dashboard</h1>
              <p className="text-accent-foreground/80 mt-1">Welcome, {currentUser?.fullName}</p>
            </div>
           
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">

          {/* Submit Feedback */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Submit Feedback</h2>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Feedback Form</CardTitle>
                <CardDescription>All submissions are anonymous and confidential</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {isAnonymous ? (
                        <UserX className="h-5 w-5 text-accent" />
                      ) : (
                        <User className="h-5 w-5 text-accent" />
                      )}
                      <div>
                        <Label htmlFor="anonymous" className="text-base cursor-pointer">
                          Submit Anonymously
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {isAnonymous
                            ? "Your identity will be kept confidential"
                            : "Your name will be visible to administrators"}
                        </p>
                      </div>
                    </div>
                    <Switch id="anonymous" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Feedback Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
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
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                      required
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IT Department">IT Department</SelectItem>
                        <SelectItem value="Registrar Office">Registrar Office</SelectItem>
                        <SelectItem value="Guidance Office">Guidance Office</SelectItem>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                        <SelectItem value="Student Affairs">Student Affairs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      placeholder="Brief summary of your feedback"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90">
                    <Send className="mr-2 h-4 w-4" />
                    Submit Feedback
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Track Feedback */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Track Your Feedback</h2>

            <Card className="shadow-lg mb-6">
              <CardHeader>
                <CardTitle>Enter Tracking ID</CardTitle>
                <CardDescription>Search for your submitted feedback</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex gap-3">
                  <Input
                    placeholder="e.g., FF-ABC123XYZ"
                    value={searchTrackingId}
                    onChange={(e) => setSearchTrackingId(e.target.value)}
                    required
                  />
                  <Button type="submit" className="bg-accent hover:bg-accent/90">
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Detail view */}
            {selectedFeedback && (
              <div className="space-y-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFeedback(null);
                    setSearchTrackingId("");
                  }}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back to My Submissions
                </Button>

                <Card className="shadow-lg">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-6">
                      <h3 className="text-lg font-semibold mb-1">
                        Status: <span className="uppercase">{selectedFeedback.status}</span>
                      </h3>
                      <Badge className={getStatusColor(selectedFeedback.status)} variant="outline">
                        {selectedFeedback.status.toLowerCase()}
                      </Badge>
                    </div>

                    <div className="flex items-start gap-3 mb-8 p-4 bg-muted/50 rounded-lg">
                      <Clock className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{getStatusMessage(selectedFeedback.status)}</p>
                    </div>

                    <div className="space-y-4">
                      {getStatusSteps(selectedFeedback.status).map((step, index) => (
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
                            {index < getStatusSteps(selectedFeedback.status).length - 1 && (
                              <div className="h-12 w-px bg-border"></div>
                            )}
                          </div>
                          <div className="pb-4 flex-1">
                            <p className="font-semibold">{step.name}</p>
                            {step.name === "Submitted" && (
                              <p className="text-sm text-muted-foreground">
                                {formatDate(selectedFeedback.createdAt)}
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

                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Feedback Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-1">Type</p>
                      <p className="capitalize">{selectedFeedback.type}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-1">Category</p>
                      <p>{selectedFeedback.category}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-1">Priority</p>
                      <p className={`capitalize ${getPriorityColor(selectedFeedback.priority)}`}>
                        {selectedFeedback.priority}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-1">Subject</p>
                      <p className="font-semibold">{selectedFeedback.subject}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-1">Message</p>
                      <p className="text-sm leading-relaxed">{selectedFeedback.message}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-1">Last Updated</p>
                      <p className="text-sm">{formatDate(selectedFeedback.updatedAt)}</p>
                    </div>
                  </CardContent>
                </Card>

                {selectedFeedback.response && (
                  <Card className="shadow-lg bg-blue-50/50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-900">
                        <MessageCircle className="h-5 w-5" />
                        Updates from Admin
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-blue-900/80 leading-relaxed">
                        {selectedFeedback.response}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Submissions list */}
            {!selectedFeedback && feedbacks.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>My Submissions</CardTitle>
                  <CardDescription>Your recent feedback submissions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {feedbacks.map((feedback) => (
                    <div
                      key={feedback.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedFeedback(feedback);
                        setSearchTrackingId(feedback.id);
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold">{feedback.subject}</p>
                        <Badge className={getStatusColor(feedback.status)} variant="outline">
                          {feedback.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {feedback.message}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-mono">{feedback.id}</span>
                        <span>{new Date(feedback.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {!selectedFeedback && feedbacks.length === 0 && (
              <Card className="shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Submissions Yet</h3>
                    <p className="text-muted-foreground">
                      Submit your first feedback using the form on the left.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}