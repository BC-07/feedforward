"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createCategoryBySuperAdmin,
  createAdminBySuperAdmin,
  disableAdminBySuperAdmin,
  enableAdminBySuperAdmin,
  deleteCategoryBySuperAdmin,
  getCategorySubmissionsLast7Days,
  getResolvedAdminsLast7Days,
  getSessionMe,
  listAdmins,
  listCategories,
  pingSuperAdminSession,
  reverifySuperAdmin,
  updateAdminBySuperAdmin,
  type Admin,
  type Category,
  type SuperAdminBarStatRow,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Shield,
  UserCog,
  UserPlus,
  Trash2,
  Pencil,
  Ban,
  UserCheck,
  Eye,
  EyeOff,
  Plus,
  Mail,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage, toastApiError } from "@/lib/errorHandling";

type CreateAdminForm = {
  firstName: string;
  lastName: string;
  email: string;
  unit: string;
};

type EditAdminForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  unit: string;
};

type StatsRange = "1d" | "7d" | "30d";

const emptyCreateForm: CreateAdminForm = {
  firstName: "",
  lastName: "",
  email: "",
  unit: "",
};

const emptyEditForm: EditAdminForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  unit: "",
};

const dashboardBarChartConfig = {
  total: {
    label: "Count",
    color: "#f59e0b",
  },
} satisfies ChartConfig;

const resolvedAdmins7DaysChartConfig = {
  resolved: {
    label: "Resolved",
    color: "#16a34a",
  },
} satisfies ChartConfig;

const ADMIN_PAGE_SIZE = 8;
const ASSIGNMENT_PAGE_SIZE = 8;
const RECENT_PAGE_SIZE = 3;
const TOP_CATEGORIES_PAGE_SIZE = 6;
const statsRangeOptions: Array<{ value: StatsRange; label: string }> = [
  { value: "1d", label: "1 Day" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "1 Month" },
];

function getDateKey(value: string | number | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

async function fetchAdmins(
  onSuccess: (admins: Admin[]) => void,
  onAuthFailure: () => void,
) {
  try {
    const data = await listAdmins();
    startTransition(() => {
      onSuccess(data);
    });
    return true;
  } catch (error) {
    toastApiError(error, "Failed to load admins.");
    const message = getErrorMessage(error, "");
    if (message.toLowerCase().includes("superadmin")) {
      onAuthFailure();
    }
    return false;
  }
}

function clearSuperAdminSession(onRedirect: () => void) {
  localStorage.removeItem("isSuperAdminLoggedIn");
  localStorage.removeItem("superAdminName");
  localStorage.removeItem("superAdminExpiresAt");
  onRedirect();
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const isAdminDashboardPage =
    pathname === "/superadmin" || pathname.startsWith("/superadmin/admin-dashboard");
  const isAdminControlPage = pathname.startsWith("/superadmin/admin-control");
  const isCategoryControlPage = pathname.startsWith("/superadmin/category-control");
  const idleLimitMs = 5 * 60 * 1000;
  const lastServerActivityRef = useRef<number | null>(null);
  const lastPingAtRef = useRef<number>(0);
  const idleExpiryCheckRef = useRef<number>(0);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [resolvedAdmins7Days, setResolvedAdmins7Days] = useState<SuperAdminBarStatRow[]>([]);
  const [categorySubmissions7Days, setCategorySubmissions7Days] = useState<SuperAdminBarStatRow[]>([]);
  const [isDashboardStatsLoading, setIsDashboardStatsLoading] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAdminForm>(emptyCreateForm);
  const [editForm, setEditForm] = useState<EditAdminForm>(emptyEditForm);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [adminFilter, setAdminFilter] = useState<"active" | "disabled">(
    "active",
  );
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [reauthAction, setReauthAction] = useState<
    "disable" | "enable" | "edit" | null
  >(
    null,
  );
  const [reauthTarget, setReauthTarget] = useState<Admin | null>(null);
  const [idleRemainingMs, setIdleRemainingMs] = useState(idleLimitMs);
  const [adminPage, setAdminPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [recentPage, setRecentPage] = useState(1);
  const [topCategoriesPage, setTopCategoriesPage] = useState(1);
  const [statsRange, setStatsRange] = useState<StatsRange>("7d");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  /*
  const stats = {
    total: admins.length,
    occupiedUnits: new Set(admins.map((admin) => admin.unit)).size,
    latestUpdate:
      admins
        .map((admin) => new Date(admin.updatedAt).getTime())
        .sort((a, b) => b - a)[0] ?? null,
  };
  */

  const visibleAdmins = admins
    .filter((admin) => {
      if (adminFilter === "disabled") {
        return Boolean(admin.isDisabled);
      }
      return !admin.isDisabled;
    })
    .sort((a, b) => {
      const aInactive = a.unit.trim().toLowerCase() === "inactive";
      const bInactive = b.unit.trim().toLowerCase() === "inactive";
      if (aInactive === bInactive) return 0;
      return aInactive ? 1 : -1;
    });

  const availableCategories = categories.filter((category) => {
    const name = category.name.trim().toLowerCase();
    if (name === "disabled" || name === "inactive") {
      return false;
    }
    return !admins.some(
      (admin) =>
        !admin.isDisabled && admin.unit.trim().toLowerCase() === name,
    );
  });

  const editAvailableCategories = categories.filter((category) => {
    const name = category.name.trim().toLowerCase();
    const currentUnit = editForm.unit.trim().toLowerCase();
    if (name === "disabled" || name === "inactive") {
      return false;
    }
    if (name === currentUnit) {
      return true;
    }
    return !admins.some(
      (admin) =>
        !admin.isDisabled && admin.unit.trim().toLowerCase() === name,
    );
  });
  const activeAdmins = useMemo(
    () => admins.filter((admin) => !admin.isDisabled),
    [admins],
  );
  const activeAdminsCount = activeAdmins.length;
  const disabledAdminsCount = admins.filter((admin) => Boolean(admin.isDisabled)).length;
  const manageableCategories = useMemo(
    () =>
      categories.filter((category) => {
        const name = category.name.trim().toLowerCase();
        return name !== "disabled" && name !== "inactive";
      }),
    [categories],
  );
  const manageableCategoriesCount = manageableCategories.length;
  const manageableCategoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    manageableCategories.forEach((category) => {
      const label = category.name.trim();
      if (!label) return;
      map.set(label.toLowerCase(), label);
    });
    return map;
  }, [manageableCategories]);
  const unitCoverageRows = useMemo(() => {
    return [...manageableCategoryNameMap.entries()]
      .map(([normalizedUnit, unitLabel]) => {
        const assignedAdmin = activeAdmins.find(
          (admin) => admin.unit.trim().toLowerCase() === normalizedUnit,
        );
        return {
          unit: unitLabel,
          adminName: assignedAdmin?.name ?? "Unassigned",
          adminEmail: assignedAdmin?.email ?? "No active admin assigned",
          covered: Boolean(assignedAdmin),
        };
      })
      .sort((a, b) => {
        if (a.covered !== b.covered) {
          return a.covered ? -1 : 1;
        }
        return a.unit.localeCompare(b.unit);
      });
  }, [activeAdmins, manageableCategoryNameMap]);
  const coveredCategoryCount = unitCoverageRows.filter((row) => row.covered).length;
  const categoryCoverageRate = manageableCategoriesCount
    ? Math.round((coveredCategoryCount / manageableCategoriesCount) * 100)
    : 0;
  const categoryControlRows = useMemo(() => {
    return manageableCategories
      .map((category) => {
        const normalizedName = category.name.trim().toLowerCase();
        const assignedAdmin = activeAdmins.find(
          (admin) => admin.unit.trim().toLowerCase() === normalizedName,
        );
        return {
          category,
          isAssigned: Boolean(assignedAdmin),
          assignedAdminName: assignedAdmin?.name ?? "Unassigned",
          assignedAdminEmail: assignedAdmin?.email ?? "No active admin assigned",
        };
      })
      .sort((a, b) => {
        if (a.isAssigned !== b.isAssigned) return a.isAssigned ? -1 : 1;
        return a.category.name.localeCompare(b.category.name);
      });
  }, [manageableCategories, activeAdmins]);
  const filteredCategoryControlRows = useMemo(() => {
    const normalizedSearch = categorySearch.trim().toLowerCase();
    return categoryControlRows.filter((row) => {
      if (categoryStatusFilter === "assigned" && !row.isAssigned) return false;
      if (categoryStatusFilter === "unassigned" && row.isAssigned) return false;
      if (!normalizedSearch) return true;
      return (
        row.category.name.toLowerCase().includes(normalizedSearch) ||
        row.assignedAdminName.toLowerCase().includes(normalizedSearch) ||
        row.assignedAdminEmail.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [categoryControlRows, categorySearch, categoryStatusFilter]);
  const assignedCategoriesCount = categoryControlRows.filter((row) => row.isAssigned).length;
  const unassignedCategoriesCount = Math.max(
    categoryControlRows.length - assignedCategoriesCount,
    0,
  );
  const latestCategoryUpdate = manageableCategories.reduce<number>(
    (latest, category) =>
      Math.max(latest, new Date(category.updatedAt).getTime() || 0),
    0,
  );
  const recentSignups7DaysData = useMemo(() => {
    const totalsByDay = new Map<string, number>();
    admins.forEach((admin) => {
      const key = getDateKey(admin.createdAt);
      totalsByDay.set(key, (totalsByDay.get(key) || 0) + 1);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const key = getDateKey(day);
      return {
        day: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        admins: totalsByDay.get(key) || 0,
      };
    });
  }, [admins]);
  const recent7DayAdmins = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDayStart = new Date(today);
    sevenDayStart.setDate(today.getDate() - 6);
    const sevenDayStartTime = sevenDayStart.getTime();

    return [...admins]
      .filter((admin) => new Date(admin.createdAt).getTime() >= sevenDayStartTime)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [admins]);
  const adminTotalPages = Math.max(1, Math.ceil(visibleAdmins.length / ADMIN_PAGE_SIZE));
  const currentAdminPage = Math.min(adminPage, adminTotalPages);
  const paginatedAdmins = useMemo(() => {
    const start = (currentAdminPage - 1) * ADMIN_PAGE_SIZE;
    return visibleAdmins.slice(start, start + ADMIN_PAGE_SIZE);
  }, [visibleAdmins, currentAdminPage]);
  const assignmentTotalPages = Math.max(
    1,
    Math.ceil(unitCoverageRows.length / ASSIGNMENT_PAGE_SIZE),
  );
  const currentAssignmentPage = Math.min(assignmentPage, assignmentTotalPages);
  const paginatedAssignmentRows = useMemo(() => {
    const start = (currentAssignmentPage - 1) * ASSIGNMENT_PAGE_SIZE;
    return unitCoverageRows.slice(start, start + ASSIGNMENT_PAGE_SIZE);
  }, [unitCoverageRows, currentAssignmentPage]);
  const recentTotalPages = Math.max(1, Math.ceil(recent7DayAdmins.length / RECENT_PAGE_SIZE));
  const currentRecentPage = Math.min(recentPage, recentTotalPages);
  const paginatedRecentAdmins = useMemo(() => {
    const start = (currentRecentPage - 1) * RECENT_PAGE_SIZE;
    return recent7DayAdmins.slice(start, start + RECENT_PAGE_SIZE);
  }, [recent7DayAdmins, currentRecentPage]);
  const recentBlankRowsCount = Math.max(
    0,
    RECENT_PAGE_SIZE - paginatedRecentAdmins.length,
  );

  const resolvedAdmins7DaysChartData = useMemo(() => {
    return resolvedAdmins7Days.map((row) => ({
      label: row.label,
      resolved: row.count,
    }));
  }, [resolvedAdmins7Days]);

  const categorySubmissions7DaysChartData = useMemo(() => {
    return categorySubmissions7Days.map((row) => ({
      label: row.label,
      submissions: row.count,
    }));
  }, [categorySubmissions7Days]);
  const topCategoriesTotalPages = Math.max(
    1,
    Math.ceil(categorySubmissions7DaysChartData.length / TOP_CATEGORIES_PAGE_SIZE),
  );
  const currentTopCategoriesPage = Math.min(topCategoriesPage, topCategoriesTotalPages);
  const paginatedTopCategories = useMemo(() => {
    const start = (currentTopCategoriesPage - 1) * TOP_CATEGORIES_PAGE_SIZE;
    return categorySubmissions7DaysChartData.slice(
      start,
      start + TOP_CATEGORIES_PAGE_SIZE,
    );
  }, [categorySubmissions7DaysChartData, currentTopCategoriesPage]);
  const maxCategorySubmissionCount = useMemo(
    () =>
      paginatedTopCategories.reduce(
        (highest, row) => Math.max(highest, row.submissions),
        0,
      ),
    [paginatedTopCategories],
  );
  const categorySubmissionColumns = useMemo(() => {
    const midpoint = Math.ceil(paginatedTopCategories.length / 2);
    return [
      paginatedTopCategories.slice(0, midpoint),
      paginatedTopCategories.slice(midpoint),
    ].filter((column) => column.length > 0);
  }, [paginatedTopCategories]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastPingAtRef.current < 4000) {
        return;
      }
      lastPingAtRef.current = now;
      void pingSuperAdminSession()
        .then((session) => {
          if (session.lastActivityAt) {
            lastServerActivityRef.current = new Date(
              session.lastActivityAt,
            ).getTime();
          }
        })
        .catch(() => {
          // apiFetch handles session expiry redirect
        });
    };

    const events: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "touchstart",
      "pointerdown",
      "focus",
    ];
    events.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true }),
    );
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleActivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity),
      );
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (lastServerActivityRef.current === null) {
        setIdleRemainingMs(idleLimitMs);
        return;
      }
      const elapsed = Date.now() - lastServerActivityRef.current;
      setIdleRemainingMs(Math.max(0, idleLimitMs - elapsed));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [idleLimitMs]);

  useEffect(() => {
    if (idleRemainingMs > 0) return;
    const now = Date.now();
    if (now - idleExpiryCheckRef.current < 5000) return;
    idleExpiryCheckRef.current = now;
    void getSessionMe()
      .then((session) => {
        if (session.lastActivityAt) {
          lastServerActivityRef.current = new Date(
            session.lastActivityAt,
          ).getTime();
        }
      })
      .catch(() => {
        // apiFetch handles session expiry redirect
      });
  }, [idleRemainingMs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void getSessionMe()
      .then((session) => {
        if (session.role !== "superadmin") {
          clearSuperAdminSession(() => router.push("/login"));
          return;
        }
        if (session.lastActivityAt) {
          lastServerActivityRef.current = new Date(
            session.lastActivityAt,
          ).getTime();
        }
        void fetchAdmins(setAdmins, () =>
          clearSuperAdminSession(() => router.push("/login")),
        );
      })
      .catch(() => {
        clearSuperAdminSession(() => router.push("/login"));
      });
    void listCategories()
      .then((data) => {
        setCategories(data);
      })
      .catch((error) => {
        toastApiError(error, "Failed to load categories.");
      });
  }, [router]);

  useEffect(() => {
    setIsDashboardStatsLoading(true);
    setTopCategoriesPage(1);
    void Promise.all([
      getResolvedAdminsLast7Days(statsRange),
      getCategorySubmissionsLast7Days(statsRange),
    ])
      .then(([resolvedAdmins, categorySubmissions]) => {
        setResolvedAdmins7Days(resolvedAdmins);
        setCategorySubmissions7Days(categorySubmissions);
      })
      .catch((error) => {
        toastApiError(error, "Failed to load dashboard statistics.");
      })
      .finally(() => {
        setIsDashboardStatsLoading(false);
      });
  }, [statsRange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const intervalId = window.setInterval(() => {
      void getSessionMe()
        .then((session) => {
          if (session.lastActivityAt) {
            lastServerActivityRef.current = new Date(
              session.lastActivityAt,
            ).getTime();
          }
        })
        .catch(() => {
          // apiFetch handles session expiry redirect
        });
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleCreateAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await createAdminBySuperAdmin(createForm);
      setCreateForm(emptyCreateForm);
      setIsCreateOpen(false);
      await fetchAdmins(setAdmins, () =>
        clearSuperAdminSession(() => router.push("/login")),
      );
      toast.success("Admin created successfully");
    } catch (error) {
      toastApiError(error, "Failed to create admin.");
    }
  };

  const handleOpenEdit = (admin: Admin) => {
    if (admin.isDisabled) {
      toast.error("Disabled admins cannot be edited.");
      return;
    }
    setSelectedAdmin(admin);
    setEditForm({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      password: "",
      unit: admin.unit,
    });
    setIsEditOpen(true);
  };

  const ensureSuperAdminSession = async () => {
    try {
      const session = await pingSuperAdminSession();
      if (session.lastActivityAt) {
        lastServerActivityRef.current = new Date(
          session.lastActivityAt,
        ).getTime();
      }
      return true;
    } catch (error) {
      toastApiError(error, "Session expired. Please log in again.");
      clearSuperAdminSession(() => router.push("/login"));
      return false;
    }
  };

  const handleUpdateAdmin = async () => {
    if (!selectedAdmin) return;
    if (!(await ensureSuperAdminSession())) return;
    setReauthAction("edit");
    setReauthTarget(selectedAdmin);
    setReauthPassword("");
    setReauthOpen(true);
  };

  const handleDisableAdmin = async (admin: Admin) => {
    if (!(await ensureSuperAdminSession())) return;
    setReauthAction("disable");
    setReauthTarget(admin);
    setReauthPassword("");
    setReauthOpen(true);
  };

  const handleEnableAdmin = async (admin: Admin) => {
    if (!(await ensureSuperAdminSession())) return;
    setReauthAction("enable");
    setReauthTarget(admin);
    setReauthPassword("");
    setReauthOpen(true);
  };

  const handleReauthConfirm = async () => {
    if (!reauthAction) return;
    if (!reauthPassword.trim()) {
      toast.error("Password is required.");
      return;
    }

    try {
      await reverifySuperAdmin(reauthPassword);
      if (reauthAction === "edit") {
        if (!selectedAdmin) return;
        await updateAdminBySuperAdmin(selectedAdmin.id, editForm);
        setIsEditOpen(false);
        setSelectedAdmin(null);
        setEditForm(emptyEditForm);
        toast.success("Admin updated successfully");
      } else if (reauthAction === "disable") {
        if (!reauthTarget) return;
        await disableAdminBySuperAdmin(reauthTarget.id);
        toast.success("Admin account disabled");
      } else if (reauthAction === "enable") {
        if (!reauthTarget) return;
        await enableAdminBySuperAdmin(reauthTarget.id);
        toast.success("Admin account enabled");
      }
      await fetchAdmins(setAdmins, () =>
        clearSuperAdminSession(() => router.push("/login")),
      );
      setReauthOpen(false);
      setReauthAction(null);
      setReauthTarget(null);
      setReauthPassword("");
    } catch (error) {
      toastApiError(error, "Re-authentication failed.");
    }
  };

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const updated = await createCategoryBySuperAdmin({
        name: newCategoryName,
      });
      setCategories(updated);
      setNewCategoryName("");
      toast.success("Category created successfully");
    } catch (error) {
      toastApiError(error, "Failed to create category.");
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    try {
      const updated = await deleteCategoryBySuperAdmin(categoryToDelete.id);
      setCategories(updated);
      await fetchAdmins(setAdmins, () =>
        clearSuperAdminSession(() => router.push("/login")),
      );
      setCreateForm((current) => ({
        ...current,
        unit: current.unit === categoryToDelete.name ? "" : current.unit,
      }));
      setEditForm((current) => ({
        ...current,
        unit: current.unit === categoryToDelete.name ? "" : current.unit,
      }));
      toast.success("Category deleted successfully");
      setDeleteCategoryOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
      toastApiError(error, "Failed to delete category.");
    } finally {
      setIsDeletingCategory(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-slate-50 via-stone-50 to-amber-50">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/*
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Admins</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Accounts currently under system control
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Occupied Units</CardDescription>
              <CardTitle className="text-3xl">{stats.occupiedUnits}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Units already assigned to an admin
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Latest Change</CardDescription>
              <CardTitle className="text-lg">
                {stats.latestUpdate
                  ? new Date(stats.latestUpdate).toLocaleString("en-US")
                  : "No updates yet"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Most recent admin record update time
            </CardContent>
          </Card>
        </div>
        */}
        <div className="space-y-6">
          {isAdminDashboardPage && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Admin Dashboard
                  </CardTitle>
                  <CardDescription>
                    Operations snapshot for admin accounts, unit ownership, and category coverage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Accounts</p>
                      <p className="mt-2 text-3xl font-semibold">{admins.length}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Admins</p>
                      <p className="mt-2 text-3xl font-semibold">{activeAdminsCount}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Disabled Admins</p>
                      <p className="mt-2 text-3xl font-semibold">{disabledAdminsCount}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Manageable Categories</p>
                      <p className="mt-2 text-3xl font-semibold">{manageableCategoriesCount}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Covered Categories</p>
                      <p className="mt-2 text-3xl font-semibold">{coveredCategoryCount}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage Rate</p>
                      <p className="mt-2 text-3xl font-semibold">{categoryCoverageRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border/70 bg-background/80 p-1">
                  {statsRangeOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={statsRange === option.value ? "default" : "ghost"}
                      className="rounded-full px-4"
                      onClick={() => setStatsRange(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Most Resolved</CardTitle>
                    <CardDescription>
                      Resolved feedbacks counted per assigned admin category.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isDashboardStatsLoading ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        Loading statistics...
                      </p>
                    ) : resolvedAdmins7DaysChartData.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        No resolved feedbacks in the last 7 days.
                      </p>
                    ) : (
                      <ChartContainer
                        config={resolvedAdmins7DaysChartConfig}
                        className="h-[290px] w-full"
                      >
                        <BarChart
                          data={resolvedAdmins7DaysChartData}
                          layout="vertical"
                          margin={{ top: 8, right: 18, left: 8, bottom: 0 }}
                        >
                          <CartesianGrid horizontal={false} />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            type="category"
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            width={120}
                          />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="resolved"
                            fill="var(--color-resolved)"
                            radius={[0, 8, 8, 0]}
                            maxBarSize={34}
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Categories</CardTitle>
                    <CardDescription>
                      Most used categories across all submissions for the selected range.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col">
                    {isDashboardStatsLoading ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        Loading statistics...
                      </p>
                    ) : categorySubmissions7DaysChartData.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        No submissions in the last 7 days.
                      </p>
                    ) : (
                      <div className="flex h-full flex-col justify-between gap-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          {categorySubmissionColumns.map((column, columnIndex) => (
                            <div key={`category-column-${columnIndex}`} className="space-y-4">
                              {column.map((row) => {
                                const width = maxCategorySubmissionCount
                                  ? `${Math.max(
                                      (row.submissions / maxCategorySubmissionCount) * 100,
                                      12,
                                    )}%`
                                  : "0%";

                                return (
                                  <div key={row.label} className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-semibold leading-6 break-words">
                                        {row.label}
                                      </p>
                                      <span className="shrink-0 text-sm font-medium text-muted-foreground">
                                        {row.submissions}
                                      </span>
                                    </div>
                                    <div className="h-3 rounded-full bg-muted/70">
                                      <div
                                        className="h-full rounded-full bg-primary"
                                        style={{ width }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                        {topCategoriesTotalPages > 1 && (
                          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-3"
                              onClick={() =>
                                setTopCategoriesPage(Math.max(1, currentTopCategoriesPage - 1))
                              }
                              disabled={currentTopCategoriesPage <= 1}
                            >
                              Previous
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-3"
                              onClick={() =>
                                setTopCategoriesPage(
                                  Math.min(
                                    topCategoriesTotalPages,
                                    currentTopCategoriesPage + 1,
                                  ),
                                )
                              }
                              disabled={currentTopCategoriesPage >= topCategoriesTotalPages}
                            >
                              Next
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Category Assignment Table</CardTitle>
                    <CardDescription>
                      Live view of which categories currently have an active admin assigned.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border overflow-hidden">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[35%]">Category</TableHead>
                            <TableHead className="w-[45%]">Assigned Admin</TableHead>
                            <TableHead className="w-[20%]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unitCoverageRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                No manageable categories available.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedAssignmentRows.map((row) => (
                              <TableRow key={row.unit}>
                                <TableCell className="font-medium break-words">{row.unit}</TableCell>
                                <TableCell className="align-top">
                                  <div>
                                    <p className="break-words">{row.adminName}</p>
                                    <p className="text-xs text-muted-foreground break-all">{row.adminEmail}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <Badge variant={row.covered ? "default" : "outline"}>
                                    {row.covered ? "Covered" : "Vacant"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {unitCoverageRows.length > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Page {currentAssignmentPage} of {assignmentTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-3"
                            onClick={() =>
                              setAssignmentPage(Math.max(1, currentAssignmentPage - 1))
                            }
                            disabled={currentAssignmentPage <= 1}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-3"
                            onClick={() =>
                              setAssignmentPage(
                                Math.min(assignmentTotalPages, currentAssignmentPage + 1),
                              )
                            }
                            disabled={currentAssignmentPage >= assignmentTotalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent Account Activity</CardTitle>
                    <CardDescription>
                      New admin accounts created over the last 7 days and latest created accounts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ChartContainer config={dashboardBarChartConfig} className="h-[190px] w-full">
                      <BarChart data={recentSignups7DaysData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        <Bar
                          dataKey="admins"
                          fill="var(--color-total)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={42}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ChartContainer>

                    <div className="rounded-lg border overflow-hidden">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50%]">Name</TableHead>
                            <TableHead className="w-[30%]">Unit</TableHead>
                            <TableHead className="w-[20%]">Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recent7DayAdmins.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                No admin accounts available yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            <>
                              {paginatedRecentAdmins.map((admin) => (
                                <TableRow key={admin.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium break-words">{admin.name}</p>
                                      <p className="text-xs text-muted-foreground break-all">{admin.email}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="break-words">{admin.unit}</TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {new Date(admin.createdAt).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {Array.from({ length: recentBlankRowsCount }, (_, index) => (
                                <TableRow key={`recent-blank-${index}`} className="h-[67px]">
                                  <TableCell>&nbsp;</TableCell>
                                  <TableCell>&nbsp;</TableCell>
                                  <TableCell>&nbsp;</TableCell>
                                </TableRow>
                              ))}
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {recent7DayAdmins.length > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Page {currentRecentPage} of {recentTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-3"
                            onClick={() => setRecentPage(Math.max(1, currentRecentPage - 1))}
                            disabled={currentRecentPage <= 1}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-3"
                            onClick={() =>
                              setRecentPage(Math.min(recentTotalPages, currentRecentPage + 1))
                            }
                            disabled={currentRecentPage >= recentTotalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {isAdminControlPage && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5" />
                    Admin Control
                  </CardTitle>
                  <CardDescription>
                    {adminFilter === "disabled"
                      ? "Reactivate disabled admin accounts when needed."
                      : "Review, modify, and disable admin accounts in the system."}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsCreateOpen(true)}
                    className="h-9 rounded-md px-3"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Create Admin
                  </Button>
                  <div className="flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-muted/40 p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={adminFilter === "active" ? "default" : "ghost"}
                      onClick={() => setAdminFilter("active")}
                      className="h-8 rounded-sm px-3"
                    >
                      Active
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={adminFilter === "disabled" ? "default" : "ghost"}
                      onClick={() => setAdminFilter("disabled")}
                      className="h-8 rounded-sm px-3"
                    >
                      Disabled
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-x-auto">
                <Table className="min-w-[780px] text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleAdmins.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-muted-foreground"
                        >
                          {adminFilter === "disabled"
                            ? "No disabled admin accounts found."
                            : "No active admin accounts found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedAdmins.map((admin) => (
                        <TableRow key={admin.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{admin.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {admin.id}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{admin.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {admin.unit}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(admin.createdAt).toLocaleDateString(
                              "en-US",
                            )}
                          </TableCell>
                          <TableCell className="text-right w-[120px]">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(admin)}
                                disabled={Boolean(admin.isDisabled)}
                                className="border-transparent bg-transparent text-black hover:bg-amber-600 hover:text-black"
                                aria-label="Edit admin"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {admin.isDisabled ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEnableAdmin(admin)}
                                  className="border-transparent bg-transparent text-black hover:bg-emerald-600 hover:text-black"
                                  aria-label="Enable admin"
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDisableAdmin(admin)}
                                  className="border-transparent bg-transparent text-black hover:bg-red-600 hover:text-black"
                                  aria-label="Disable admin"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {visibleAdmins.length > 0 && (
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Page {currentAdminPage} of {adminTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3"
                      onClick={() => setAdminPage(Math.max(1, currentAdminPage - 1))}
                      disabled={currentAdminPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3"
                      onClick={() =>
                        setAdminPage(Math.min(adminTotalPages, currentAdminPage + 1))
                      }
                      disabled={currentAdminPage >= adminTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {isCategoryControlPage && (
          <Card className="h-fit">
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total Categories
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{categoryControlRows.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Assigned
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{assignedCategoriesCount}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Unassigned
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{unassignedCategoriesCount}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Last Updated
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {latestCategoryUpdate > 0
                      ? new Date(latestCategoryUpdate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "No updates yet"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-sm font-medium">Create Category</p>
                  <form
                    onSubmit={handleCreateCategory}
                    className="mt-2 flex flex-col gap-2 sm:flex-row"
                  >
                    <Input
                      placeholder="Enter category name"
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      required
                      className="sm:flex-1"
                    />
                    <Button type="submit" className="sm:min-w-[150px]">
                      Create Category
                    </Button>
                  </form>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-sm font-medium">Find Category</p>
                  <Input
                    placeholder="Search category or admin"
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={categoryStatusFilter === "all" ? "default" : "ghost"}
                  onClick={() => setCategoryStatusFilter("all")}
                  className="h-8 rounded-sm px-3"
                >
                  All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={categoryStatusFilter === "assigned" ? "default" : "ghost"}
                  onClick={() => setCategoryStatusFilter("assigned")}
                  className="h-8 rounded-sm px-3"
                >
                  Assigned
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={categoryStatusFilter === "unassigned" ? "default" : "ghost"}
                  onClick={() => setCategoryStatusFilter("unassigned")}
                  className="h-8 rounded-sm px-3"
                >
                  Unassigned
                </Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[26%] py-2.5">Category</TableHead>
                      <TableHead className="w-[12%] py-2.5">Status</TableHead>
                      <TableHead className="w-[30%] py-2.5">Assigned Admin</TableHead>
                      <TableHead className="w-[17%] py-2.5">Updated</TableHead>
                      <TableHead className="w-[15%] py-2.5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategoryControlRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No categories match your current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCategoryControlRows.map((row) => (
                        <TableRow key={row.category.id}>
                          <TableCell className="py-2.5 align-top">
                            <p className="font-medium break-words">{row.category.name}</p>
                          </TableCell>
                          <TableCell className="py-2.5 align-top">
                            <Badge
                              variant={row.isAssigned ? "default" : "outline"}
                              className="h-6 px-2 text-sm"
                            >
                              {row.isAssigned ? "Assigned" : "Unassigned"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 align-top">
                            <div>
                              <p className="break-words leading-snug">{row.assignedAdminName}</p>
                              <p className="text-xs text-muted-foreground break-all leading-snug">
                                {row.assignedAdminEmail}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 align-top">
                            {new Date(row.category.updatedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="py-2.5 text-right align-top">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => {
                                  setCategoryToDelete(row.category);
                                  setDeleteCategoryOpen(true);
                                }}
                                className="h-8 w-8 border-border p-0 text-foreground hover:border-red-600 hover:bg-red-600 hover:text-black"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      <AlertDialog
        open={deleteCategoryOpen}
        onOpenChange={(open) => {
          setDeleteCategoryOpen(open);
          if (!open && !isDeletingCategory) {
            setCategoryToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              {categoryToDelete
                ? `This will permanently remove "${categoryToDelete.name}" from categories and cannot be undone.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCategory}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              disabled={isDeletingCategory || !categoryToDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingCategory ? "Deleting..." : "Delete Category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-border/70 bg-card p-0 shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-w-xl data-[state=open]:duration-200 data-[state=closed]:duration-150">
          <DialogHeader className="border-b border-border/60 px-6 py-6 pr-14">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <UserPlus className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-semibold tracking-tight">
                  Create Admin
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Provision a new unit admin account.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreateAdmin} className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-first-name" className="text-sm font-medium">
                  First Name
                </Label>
                <Input
                  id="create-first-name"
                  value={createForm.firstName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                  placeholder="e.g. Juan"
                  className="h-11 rounded-xl border-slate-300 bg-slate-50 px-4 shadow-sm focus-visible:border-primary/70 focus-visible:ring-primary/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-last-name" className="text-sm font-medium">
                  Last Name
                </Label>
                <Input
                  id="create-last-name"
                  value={createForm.lastName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                  placeholder="e.g. Dela Cruz"
                  className="h-11 rounded-xl border-slate-300 bg-slate-50 px-4 shadow-sm focus-visible:border-primary/70 focus-visible:ring-primary/20"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email" className="text-sm font-medium">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="admin@school.edu.ph"
                  className="h-11 rounded-xl border-slate-300 bg-slate-50 pr-4 pl-11 shadow-sm focus-visible:border-primary/70 focus-visible:ring-primary/20"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Unit</Label>
              <Select
                value={createForm.unit}
                onValueChange={(value) =>
                  setCreateForm((current) => ({ ...current, unit: value }))
                }
              >
                <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-slate-50 px-4 shadow-sm focus-visible:border-primary/70 focus-visible:ring-primary/20">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/8 px-4 py-3 text-sm text-foreground">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="leading-6 text-muted-foreground">
                A verification email will be sent to the provided address. Make sure the
                email is correct so the new admin can set their password.
              </p>
            </div>
            <div className="space-y-3 pt-1">
              <Button type="submit" className="h-12 w-full rounded-full text-base font-semibold">
              Create Admin Account
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full text-sm text-muted-foreground"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
            <DialogDescription>
              Update the selected admin account and save changes back to the
              database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name">First Name</Label>
              <Input
                id="edit-first-name"
                value={editForm.firstName}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-name">Last Name</Label>
              <Input
                id="edit-last-name"
                value={editForm.lastName}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password</Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showEditPassword ? "text" : "password"}
                  value={editForm.password}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Leave blank to keep current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowEditPassword((prev) => !prev)}
                  aria-label={showEditPassword ? "Hide password" : "Show password"}
                >
                  {showEditPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={editForm.unit}
                onValueChange={(value) =>
                  setEditForm((current) => ({ ...current, unit: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editAvailableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdateAdmin} className="w-full">
              Save Admin Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reauthOpen} onOpenChange={setReauthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-authenticate</DialogTitle>
            <DialogDescription>
              Please confirm your superadmin password to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reauth-password">Password</Label>
              <div className="relative">
                <Input
                  id="reauth-password"
                  type={showReauthPassword ? "text" : "password"}
                  value={reauthPassword}
                  onChange={(event) => setReauthPassword(event.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowReauthPassword((prev) => !prev)}
                  aria-label={showReauthPassword ? "Hide password" : "Show password"}
                >
                  {showReauthPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReauthOpen(false);
                  setReauthAction(null);
                  setReauthTarget(null);
                  setReauthPassword("");
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleReauthConfirm}>
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
