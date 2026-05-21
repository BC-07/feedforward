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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  LogOut,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Pencil,
  Trash2,
  Search,
  UserCircle2,
} from "lucide-react";

interface Feedback {
  id: string;
  type: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  userId?: string | null;
  userName?: string;
  submittedBy?: string;
  isAnonymous?: boolean;
  createdAt: string;
  updatedAt: string;
  response?: string;
}

const UNITS = [
  "IT Unit",
  "Finance & Registrar Office",
  "Student Affair Office",
  "Guidance Office",
  "Faculty Office",
];

export default function AdminDashboard() {
  const router = useRouter();
  const [currentAdmin, setCurrentAdmin] = useState<{
    id: string;
    name: string;
    email: string;
    unit: string;
  } | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null,
  );
  const [response, setResponse] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterName, setFilterName] = useState("asc");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newUnit, setNewUnit] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isLoggedIn = localStorage.getItem("isAdminLoggedIn");
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    const adminId = localStorage.getItem("currentAdminId") || "";
    const adminName = localStorage.getItem("currentAdminName") || "";
    const adminEmail = localStorage.getItem("currentAdminEmail") || "";
    const adminUnit = localStorage.getItem("currentAdminDepartment") || "";

    console.log("[Dashboard] adminUnit from localStorage:", adminUnit);

    const admin = {
      id: adminId,
      name: adminName,
      email: adminEmail,
      unit: adminUnit,
    };
    setCurrentAdmin(admin);

    const stored: Feedback[] = JSON.parse(
      localStorage.getItem("feedbacks") || "[]",
    );
    console.log("[Dashboard] all feedbacks:", stored);
    console.log(
      "[Dashboard] feedbacks categories:",
      stored.map((f) => f.category),
    );
    console.log("[Dashboard] filtering by unit:", adminUnit);

    // FIX: case-insensitive + trimmed category match
    const filtered = stored.filter(
      (f) =>
        f.category?.trim().toLowerCase() === adminUnit?.trim().toLowerCase(),
    );
    console.log("[Dashboard] filtered feedbacks:", filtered);
    setFeedbacks(filtered);
  }, [router]);

  const loadFeedbacks = (unit: string) => {
    const stored: Feedback[] = JSON.parse(
      localStorage.getItem("feedbacks") || "[]",
    );
    // FIX: case-insensitive + trimmed category match
    setFeedbacks(
      stored.filter(
        (f) => f.category?.trim().toLowerCase() === unit?.trim().toLowerCase(),
      ),
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("currentAdminId");
    localStorage.removeItem("currentAdminName");
    localStorage.removeItem("currentAdminEmail");
    localStorage.removeItem("currentAdminDepartment");
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const handleUpdateFeedback = () => {
    if (!selectedFeedback) return;

    const allFeedbacks: Feedback[] = JSON.parse(
      localStorage.getItem("feedbacks") || "[]",
    );
    const updated = allFeedbacks.map((f) =>
      f.id === selectedFeedback.id
        ? {
            ...f,
            status: newStatus || f.status,
            response: response || f.response,
            priority: newPriority || f.priority,
            updatedAt: new Date().toISOString(),
          }
        : f,
    );

    localStorage.setItem("feedbacks", JSON.stringify(updated));
    setFeedbacks(
      updated.filter(
        (f) =>
          f.category?.trim().toLowerCase() ===
          currentAdmin?.unit?.trim().toLowerCase(),
      ),
    );
    toast.success("Feedback updated successfully");
    setSelectedFeedback(null);
    setResponse("");
    setNewStatus("");
    setNewPriority("");
    setIsEditDialogOpen(false);
  };

  const handleDeleteFeedback = (feedbackId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this feedback? This action cannot be undone.",
      )
    )
      return;

    const allFeedbacks: Feedback[] = JSON.parse(
      localStorage.getItem("feedbacks") || "[]",
    );
    const updated = allFeedbacks.filter((f) => f.id !== feedbackId);
    localStorage.setItem("feedbacks", JSON.stringify(updated));
    setFeedbacks(
      updated.filter(
        (f) =>
          f.category?.trim().toLowerCase() ===
          currentAdmin?.unit?.trim().toLowerCase(),
      ),
    );
    toast.success("Feedback deleted successfully");
  };

  const handleUnitChange = () => {
    if (!newUnit || newUnit === currentAdmin?.unit) return;

    const admins = JSON.parse(localStorage.getItem("admins") || "[]");
    const unitTaken = admins.some(
      (a: any) =>
        (a.unit === newUnit || a.department === newUnit) &&
        a.id !== currentAdmin?.id,
    );
    if (unitTaken) {
      toast.error("This unit already has an admin. Change is not allowed.");
      return;
    }

    const updatedAdmins = admins.map((a: any) =>
      a.id === currentAdmin?.id
        ? { ...a, unit: newUnit, department: newUnit }
        : a,
    );
    localStorage.setItem("admins", JSON.stringify(updatedAdmins));
    localStorage.setItem("currentAdminDepartment", newUnit);

    const updatedAdmin = { ...currentAdmin!, unit: newUnit };
    setCurrentAdmin(updatedAdmin);
    loadFeedbacks(newUnit);
    setNewUnit("");
    setIsProfileOpen(false);
    toast.success("Unit updated successfully!");
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "under review":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "in progress":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "resolved":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "closed":
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "low":
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-700 border-orange-500/20";
      case "urgent":
        return "bg-red-500/10 text-red-700 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const stats = {
    total: feedbacks.length,
    pending: feedbacks.filter((f) => f.status === "Pending").length,
    inProgress: feedbacks.filter((f) => f.status === "In Progress").length,
    resolved: feedbacks.filter((f) => f.status === "Resolved").length,
  };

  const filteredFeedbacks = feedbacks
    .filter((feedback) => {
      const matchesSearch =
        feedback.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feedback.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feedback.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || feedback.type === filterType;
      // FIX: use regex replace to remove ALL spaces for comparison
      const matchesStatus =
        filterStatus === "all" ||
        feedback.status.toLowerCase().replace(/\s+/g, "") === filterStatus;
      const matchesPriority =
        filterPriority === "all" ||
        feedback.priority?.toLowerCase() === filterPriority;
      return matchesSearch && matchesType && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      if (filterName === "all" || filterName === "") return 0;
      const nameA = (
        a.isAnonymous ? "*****" : a.submittedBy || a.userName || "*****"
      ).toLowerCase();
      const nameB = (
        b.isAnonymous ? "*****" : b.submittedBy || b.userName || "*****"
      ).toLowerCase();
      return filterName === "asc"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted">
      {/* Header */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-primary-foreground/80 mt-1">
                {currentAdmin?.name && (
                  <span className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4" />
                    <span>
                      {currentAdmin.name} &mdash; {currentAdmin.unit}
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Feedback</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>All submissions</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">
                {stats.pending}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Awaiting review</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {stats.inProgress}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Being addressed</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {stats.resolved}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4" />
                <span>Completed</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search &amp; Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex gap-1 flex-1 min-w-[220px]">
                <div className="flex-1">
                  <Input
                    placeholder="Search by ID, subject, or message..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterName} onValueChange={setFilterName}>
                  <SelectTrigger className="w-[100px] shrink-0">
                    <SelectValue placeholder="Name" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">A → Z</SelectItem>
                    <SelectItem value="desc">Z → A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[130px]">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="suggestion">Suggestion</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="inquiry">Inquiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[130px]">
                <Select
                  value={filterPriority}
                  onValueChange={setFilterPriority}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[130px]">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="underreview">Under Review</SelectItem>
                    <SelectItem value="inprogress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Feedback Submissions
            </CardTitle>
            <CardDescription>
              Showing {filteredFeedbacks.length} of {feedbacks.length}{" "}
              submissions
              {currentAdmin?.unit && ` for ${currentAdmin.unit}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredFeedbacks.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Feedback Found
                </h3>
                <p className="text-muted-foreground">
                  {feedbacks.length === 0
                    ? `No feedback submissions yet for ${currentAdmin?.unit}.`
                    : "Try adjusting your search or filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Tracking ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeedbacks.map((feedback) => (
                      <TableRow key={feedback.id}>
                        <TableCell className="font-mono text-sm">
                          {feedback.isAnonymous
                            ? "*****"
                            : feedback.submittedBy
                              ? feedback.submittedBy.split(" ")[0]
                              : feedback.userName
                                ? feedback.userName.split(" ")[0]
                                : "*****"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {feedback.id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {feedback.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{feedback.category}</TableCell>
                        <TableCell>
                          <Badge
                            className={getPriorityColor(feedback.priority)}
                            variant="outline"
                          >
                            {feedback.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={getStatusColor(feedback.status)}
                            variant="outline"
                          >
                            {feedback.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(feedback.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog
                            open={
                              isEditDialogOpen &&
                              selectedFeedback?.id === feedback.id
                            }
                            onOpenChange={(open) => {
                              if (!open) {
                                setIsEditDialogOpen(false);
                                setSelectedFeedback(null);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedFeedback(feedback);
                                  setResponse(feedback.response || "");
                                  setNewStatus(feedback.status);
                                  setNewPriority(feedback.priority);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Feedback Details</DialogTitle>
                                <DialogDescription>
                                  Tracking ID: {selectedFeedback?.id}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedFeedback && (
                                <Tabs defaultValue="details" className="w-full">
                                  <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="details">
                                      Details
                                    </TabsTrigger>
                                    <TabsTrigger value="manage">
                                      Manage
                                    </TabsTrigger>
                                  </TabsList>
                                  <TabsContent
                                    value="details"
                                    className="space-y-4"
                                  >
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Type
                                        </Label>
                                        <p className="font-medium capitalize">
                                          {selectedFeedback.type}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Category
                                        </Label>
                                        <p className="font-medium">
                                          {selectedFeedback.category}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Status
                                        </Label>
                                        <Badge
                                          className={getStatusColor(
                                            selectedFeedback.status,
                                          )}
                                          variant="outline"
                                        >
                                          {selectedFeedback.status}
                                        </Badge>
                                      </div>
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Submitted
                                        </Label>
                                        <p className="font-medium">
                                          {new Date(
                                            selectedFeedback.createdAt,
                                          ).toLocaleString()}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Submitted By
                                        </Label>
                                        <p className="font-medium">
                                          {selectedFeedback.isAnonymous
                                            ? "*****"
                                            : selectedFeedback.submittedBy ||
                                              selectedFeedback.userName ||
                                              "*****"}
                                        </p>
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">
                                        Subject
                                      </Label>
                                      <p className="font-medium">
                                        {selectedFeedback.subject}
                                      </p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">
                                        Message
                                      </Label>
                                      <div className="bg-muted rounded-lg p-4 mt-2">
                                        <p className="text-sm whitespace-pre-wrap">
                                          {selectedFeedback.message}
                                        </p>
                                      </div>
                                    </div>
                                    {selectedFeedback.response && (
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Current Response
                                        </Label>
                                        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mt-2">
                                          <p className="text-sm whitespace-pre-wrap">
                                            {selectedFeedback.response}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </TabsContent>
                                  <TabsContent
                                    value="manage"
                                    className="space-y-4"
                                  >
                                    <div className="space-y-2">
                                      <Label htmlFor="status">
                                        Update Status
                                      </Label>
                                      <Select
                                        value={newStatus}
                                        onValueChange={setNewStatus}
                                      >
                                        <SelectTrigger id="status">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Pending">
                                            Pending
                                          </SelectItem>
                                          <SelectItem value="Under Review">
                                            Under Review
                                          </SelectItem>
                                          <SelectItem value="In Progress">
                                            In Progress
                                          </SelectItem>
                                          <SelectItem value="Resolved">
                                            Resolved
                                          </SelectItem>
                                          <SelectItem value="Closed">
                                            Closed
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="priority">
                                        Update Priority
                                      </Label>
                                      <Select
                                        value={newPriority}
                                        onValueChange={setNewPriority}
                                      >
                                        <SelectTrigger id="priority">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Low">
                                            Low
                                          </SelectItem>
                                          <SelectItem value="Medium">
                                            Medium
                                          </SelectItem>
                                          <SelectItem value="High">
                                            High
                                          </SelectItem>
                                          <SelectItem value="Urgent">
                                            Urgent
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="response">
                                        Add/Update Response
                                      </Label>
                                      <Textarea
                                        id="response"
                                        placeholder="Enter your response to the user..."
                                        rows={5}
                                        value={response}
                                        onChange={(e) =>
                                          setResponse(e.target.value)
                                        }
                                      />
                                    </div>
                                    <Button
                                      onClick={handleUpdateFeedback}
                                      className="w-full bg-accent hover:bg-accent/90"
                                    >
                                      Update Feedback
                                    </Button>
                                  </TabsContent>
                                </Tabs>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFeedback(feedback.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin Profile Sheet */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent className="w-[360px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Admin Profile</SheetTitle>
            <SheetDescription>Your account information</SheetDescription>
          </SheetHeader>
          <div className="mt-8 space-y-6">
            <div className="flex flex-col items-center gap-3 pb-6 border-b">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle2 className="h-12 w-12 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{currentAdmin?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {currentAdmin?.unit}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Full Name
                </p>
                <p className="font-medium">{currentAdmin?.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Email
                </p>
                <p className="font-medium">{currentAdmin?.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Current Unit
                </p>
                <p className="font-medium">{currentAdmin?.unit}</p>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t">
              <div>
                <p className="text-sm font-semibold mb-1">Change Unit</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Each unit can only have one admin. If the selected unit is
                  already taken, the change will be rejected.
                </p>
              </div>
              <Select value={newUnit} onValueChange={setNewUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full bg-accent hover:bg-accent/90"
                onClick={handleUnitChange}
                disabled={!newUnit || newUnit === currentAdmin?.unit}
              >
                Save Unit
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
