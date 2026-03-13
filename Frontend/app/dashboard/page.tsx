"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listFeedbacks,
  updateFeedback,
  type Feedback,
} from "@/lib/api";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Search,
  TrendingUp,
  UserCircle2,
} from "lucide-react";
import { ActionButton } from "@/components/ux/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ux/async-state";
import { PriorityBadge, StatusBadge, UnitBadge } from "@/components/ux/badges";

const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"] as const;
const PRIORITY_OPTIONS = ["Low", "Medium", "High"] as const;

export default function AdminDashboard() {
  const router = useRouter();
  const [currentAdmin, setCurrentAdmin] = useState<{
    id: string;
    name: string;
    email: string;
    unit: string;
  } | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [response, setResponse] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterName, setFilterName] = useState("asc");
  const [filterDate, setFilterDate] = useState("recent");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);

  const loadFeedbacks = async (unit: string) => {
    if (!unit.trim()) {
      setFeedbacks([]);
      setIsLoading(false);
      setLoadError("");
      return;
    }

    setIsLoading(true);
    setLoadError("");
    try {
      const data = await listFeedbacks({ category: unit });
      setFeedbacks(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load feedbacks.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isLoggedIn = localStorage.getItem("isAdminLoggedIn");
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

<<<<<<< HEAD
    const admin = {
=======
    setCurrentAdmin({
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be
      id: localStorage.getItem("currentAdminId") || "",
      name: localStorage.getItem("currentAdminName") || "",
      email: localStorage.getItem("currentAdminEmail") || "",
      unit: localStorage.getItem("currentAdminDepartment") || "",
<<<<<<< HEAD
    };
    setCurrentAdmin(admin);
    void loadFeedbacks(admin.unit);
  }, [router]);

  const stats = useMemo(
    () => ({
      total: feedbacks.length,
      pending: feedbacks.filter((feedback) => feedback.status === "Pending").length,
      inProgress: feedbacks.filter((feedback) => feedback.status === "In Progress").length,
      resolved: feedbacks.filter((feedback) => feedback.status === "Resolved").length,
    }),
    [feedbacks],
  );

  const filteredFeedbacks = useMemo(
    () =>
      feedbacks
        .filter((feedback) => {
          const query = searchQuery.toLowerCase();
          const matchesSearch =
            feedback.subject.toLowerCase().includes(query) ||
            feedback.message.toLowerCase().includes(query) ||
            feedback.id.toLowerCase().includes(query);
          const matchesType = filterType === "all" || feedback.type === filterType;
          const matchesStatus =
            filterStatus === "all" ||
            feedback.status.toLowerCase().replace(/\s+/g, "") === filterStatus;
          const matchesPriority =
            filterPriority === "all" ||
            feedback.priority?.toLowerCase() === filterPriority;

          return matchesSearch && matchesType && matchesStatus && matchesPriority;
        })
        .sort((a, b) => {
          if (filterName === "all" || filterName === "") {
            return 0;
          }
          const nameA = (a.isAnonymous ? "*****" : a.userName || "*****").toLowerCase();
          const nameB = (b.isAnonymous ? "*****" : b.userName || "*****").toLowerCase();
          return filterName === "asc"
            ? nameA.localeCompare(nameB)
            : nameB.localeCompare(nameA);
        }),
    [feedbacks, filterName, filterPriority, filterStatus, filterType, searchQuery],
  );
=======
    });
  }, [router]);

  useEffect(() => {
    if (!currentAdmin?.unit) return;

    void listFeedbacks({ category: currentAdmin.unit })
      .then((data) => {
        startTransition(() => {
          setFeedbacks(data);
        });
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to load feedbacks.",
        );
      });
  }, [currentAdmin?.unit]);
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be

  const openEditDialog = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setResponse(feedback.response || "");
    setNewStatus(feedback.status);
    setNewPriority(feedback.priority || "Medium");
    setIsEditDialogOpen(true);
  };

  const handleUpdateFeedback = async () => {
    if (!selectedFeedback) {
      return;
    }

    const nextStatus = newStatus || selectedFeedback.status;
    const nextPriority = newPriority || selectedFeedback.priority;
    const nextResponse = response || selectedFeedback.response || "";
    const previousFeedbacks = feedbacks;

    setIsSavingUpdate(true);
    setFeedbacks((current) =>
      current.map((feedback) =>
        feedback.id === selectedFeedback.id
          ? {
              ...feedback,
              status: nextStatus,
              priority: nextPriority,
              response: nextResponse,
              updatedAt: new Date().toISOString(),
            }
          : feedback,
      ),
    );

<<<<<<< HEAD
    try {
      const updated = await updateFeedback(selectedFeedback.id, {
        status: nextStatus,
        priority: nextPriority,
        response: nextResponse,
      });
      setFeedbacks((current) =>
        current.map((feedback) => (feedback.id === updated.id ? updated : feedback)),
      );
      toast.success("Feedback updated successfully.");
      setSelectedFeedback(updated);
      setIsEditDialogOpen(false);
    } catch (error) {
      setFeedbacks(previousFeedbacks);
      toast.error(error instanceof Error ? error.message : "Failed to update feedback.");
    } finally {
      setIsSavingUpdate(false);
=======
    const updatedAdmin = { ...currentAdmin!, unit: newUnit };
    setCurrentAdmin(updatedAdmin);
    setNewUnit("");
    setIsProfileOpen(false);
    toast.success("Unit updated successfully!");
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "in progress":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "resolved":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be
    }
  };

  const renderTableContent = () => {
    if (isLoading) {
      return <LoadingState label="Loading feedback submissions..." />;
    }
    if (loadError) {
      return (
        <ErrorState
          message={loadError}
          onRetry={() => {
            if (currentAdmin?.unit) {
              void loadFeedbacks(currentAdmin.unit);
            }
          }}
        />
      );
    }
    if (filteredFeedbacks.length === 0) {
      return (
        <EmptyState
          title="No feedback found"
          message={
            feedbacks.length === 0
              ? `No submissions yet for ${currentAdmin?.unit || "this unit"}.`
              : "Try adjusting filters or search query."
          }
        />
      );
    }

    return (
      <>
        <div className="hidden md:block ff-table-shell">
          <Table>
            <TableHeader className="ff-table-header">
              <TableRow className="ff-table-row">
                <TableHead>Name</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedbacks.map((feedback) => (
                <TableRow key={feedback.id} className="ff-table-row">
                  <TableCell className="font-mono text-sm">
                    {feedback.isAnonymous
                      ? "*****"
                      : feedback.userName
                        ? feedback.userName.split(" ")[0]
                        : "*****"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{feedback.id}</TableCell>
                  <TableCell className="capitalize">{feedback.type}</TableCell>
                  <TableCell>
                    <UnitBadge unit={feedback.category} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={feedback.priority || "Medium"} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={feedback.status} />
                  </TableCell>
                  <TableCell>{new Date(feedback.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <ActionButton
                      action="edit"
                      icon={<Pencil className="h-4 w-4" />}
                      label="Edit"
                      onClick={() => openEditDialog(feedback)}
                      aria-label={`Edit feedback ${feedback.id}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

<<<<<<< HEAD
        <div className="space-y-3 md:hidden">
          {filteredFeedbacks.map((feedback) => (
            <Card key={feedback.id} className="ff-surface">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{feedback.subject}</p>
                    <p className="text-xs text-muted-foreground">{feedback.id}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Open actions for feedback ${feedback.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(feedback)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={feedback.priority || "Medium"} />
                  <StatusBadge status={feedback.status} />
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{feedback.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(feedback.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  };
=======
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
      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesPriority
      );
    })
    .sort((a, b) => {
      if (filterDate === "recent") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (filterDate === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      if (filterName === "all" || filterName === "") return 0;
      const nameA = (
        a.isAnonymous ? "*****" : a.userName || "*****"
      ).toLowerCase();
      const nameB = (
        b.isAnonymous ? "*****" : b.userName || "*****"
      ).toLowerCase();
      return filterName === "asc"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be

  return (
    <div className="ff-page-shell">
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="mt-1 text-primary-foreground/80">
                {currentAdmin?.name && (
                  <span className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4" />
                    {currentAdmin.name} - {currentAdmin.unit}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="ff-surface">
            <CardHeader className="pb-3">
              <CardDescription>Total Feedback</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              All submissions
            </CardContent>
          </Card>
          <Card className="ff-surface">
            <CardHeader className="pb-3">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Awaiting review
            </CardContent>
          </Card>
          <Card className="ff-surface">
            <CardHeader className="pb-3">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.inProgress}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Being addressed
            </CardContent>
          </Card>
          <Card className="ff-surface">
            <CardHeader className="pb-3">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.resolved}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Completed
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 ff-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search and Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[220px] flex-1 gap-1">
                <Input
                  placeholder="Search by tracking ID, subject, or message"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <Select value={filterName} onValueChange={setFilterName}>
                  <SelectTrigger className="w-[100px] shrink-0">
                    <SelectValue placeholder="Name" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">A to Z</SelectItem>
                    <SelectItem value="desc">Z to A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <Select value={filterDate} onValueChange={setFilterDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
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
                <Select value={filterPriority} onValueChange={setFilterPriority}>
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
                    <SelectItem value="inprogress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="ff-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Feedback Submissions
            </CardTitle>
            <CardDescription>
              Showing {filteredFeedbacks.length} of {feedbacks.length} submissions
              {currentAdmin?.unit ? ` for ${currentAdmin.unit}` : ""}
            </CardDescription>
          </CardHeader>
<<<<<<< HEAD
          <CardContent>{renderTableContent()}</CardContent>
=======
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
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table className="[&_th]:px-3 [&_td]:px-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Tracking ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="whitespace-nowrap w-[150px]">
                        Date
                      </TableHead>
                      <TableHead className="text-right w-[110px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeedbacks.map((feedback) => (
                      <TableRow key={feedback.id}>
                        <TableCell className="font-mono text-sm">
                          {feedback.isAnonymous
                            ? "*****"
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
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {(() => {
                            const date = new Date(feedback.createdAt);
                            const datePart = date.toLocaleDateString("en-US", {
                              timeZone: "Asia/Manila",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            });
                            const timePart = date
                              .toLocaleTimeString("en-US", {
                                timeZone: "Asia/Manila",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                              .replace(" ", "")
                              .toLowerCase();
                            return `${datePart} ${timePart}`;
                          })()}
                        </TableCell>
                        <TableCell className="text-right w-[110px]">
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
                                          ).toLocaleString("en-US")}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-muted-foreground">
                                          Submitted By
                                        </Label>
                                        <p className="font-medium">
                                          {selectedFeedback.isAnonymous
                                            ? "*****"
                                            : selectedFeedback.userName ||
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
                                          <SelectItem value="In Progress">
                                            In Progress
                                          </SelectItem>
                                          <SelectItem value="Resolved">
                                            Resolved
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
                                    <p className="text-xs text-muted-foreground">
                                      Marking a submission as Resolved will
                                      email the user if they registered an
                                      account.
                                    </p>
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
>>>>>>> 5dac3556f87e50ad45daf3b4e7705c72bf7d10be
        </Card>
      </div>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedFeedback(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feedback Details</DialogTitle>
            <DialogDescription>Tracking ID: {selectedFeedback?.id}</DialogDescription>
          </DialogHeader>
          {selectedFeedback && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="manage">Manage</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="font-medium capitalize">{selectedFeedback.type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">{selectedFeedback.category}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <StatusBadge status={selectedFeedback.status} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Submitted</Label>
                    <p className="font-medium">
                      {new Date(selectedFeedback.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Submitted By</Label>
                    <p className="font-medium">
                      {selectedFeedback.isAnonymous ? "*****" : selectedFeedback.userName || "*****"}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Subject</Label>
                  <p className="font-medium">{selectedFeedback.subject}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Message</Label>
                  <div className="mt-2 rounded-lg bg-muted p-4">
                    <p className="whitespace-pre-wrap text-sm">{selectedFeedback.message}</p>
                  </div>
                </div>
                {selectedFeedback.response && (
                  <div>
                    <Label className="text-muted-foreground">Current Response</Label>
                    <div className="mt-2 rounded-lg border border-accent/20 bg-accent/5 p-4">
                      <p className="whitespace-pre-wrap text-sm">{selectedFeedback.response}</p>
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="manage" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Update Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Update Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="response">Add or Update Response</Label>
                  <Textarea
                    id="response"
                    placeholder="Enter your response to the user..."
                    rows={5}
                    value={response}
                    onChange={(event) => setResponse(event.target.value)}
                  />
                </div>
                <Button
                  onClick={handleUpdateFeedback}
                  className="w-full bg-accent hover:bg-accent/90"
                  disabled={isSavingUpdate}
                >
                  {isSavingUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Feedback
                </Button>
              </TabsContent>
            </Tabs>
          )}
          {!selectedFeedback && (
            <div className="py-8 text-center text-muted-foreground">
              <AlertCircle className="mx-auto mb-2 h-6 w-6" />
              Select feedback to edit.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
