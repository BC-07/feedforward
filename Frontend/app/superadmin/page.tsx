"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoryBySuperAdmin,
  createAdminBySuperAdmin,
  disableAdminBySuperAdmin,
  enableAdminBySuperAdmin,
  deleteCategoryBySuperAdmin,
  getSessionMe,
  listAdmins,
  listCategories,
  logout,
  pingSuperAdminSession,
  reverifySuperAdmin,
  updateCategoryBySuperAdmin,
  updateAdminBySuperAdmin,
  type Admin,
  type Category,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, UserCog, UserPlus, Trash2, Pencil, Tag, Save, Ban } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage, toastApiError } from "@/lib/errorHandling";

const emptyCreateForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  unit: "",
};

const emptyEditForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  unit: "",
};

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
  const isDev = process.env.NODE_ENV !== "production";
  const idleLimitMs = 5 * 60 * 1000;
  const lastServerActivityRef = useRef<number | null>(null);
  const lastPingAtRef = useRef<number>(0);
  const idleExpiryCheckRef = useRef<number>(0);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryOriginalName, setEditingCategoryOriginalName] = useState("");
  const [adminFilter, setAdminFilter] = useState<"active" | "disabled">(
    "active",
  );
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthAction, setReauthAction] = useState<
    "disable" | "enable" | "edit" | null
  >(
    null,
  );
  const [reauthTarget, setReauthTarget] = useState<Admin | null>(null);
  const [idleRemainingMs, setIdleRemainingMs] = useState(idleLimitMs);

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

  const getUnitClass = (unit: string) => {
    const normalized = unit.trim().toLowerCase();
    if (normalized.includes("it")) {
      return "bg-blue-500/10 text-blue-700 border-blue-500/30";
    }
    if (normalized.includes("finance") || normalized.includes("registrar")) {
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
    }
    if (normalized.includes("student")) {
      return "bg-violet-500/10 text-violet-700 border-violet-500/30";
    }
    if (normalized.includes("guidance")) {
      return "bg-cyan-500/10 text-cyan-700 border-cyan-500/30";
    }
    if (normalized.includes("faculty")) {
      return "bg-amber-500/10 text-amber-700 border-amber-500/30";
    }
    return "bg-gray-500/10 text-gray-700 border-gray-500/30";
  };

  const getStatusClass = (isDisabled?: boolean) =>
    isDisabled
      ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
      : "bg-blue-500/10 text-blue-700 border-blue-500/30";

  const visibleAdmins = admins.filter((admin) => {
    if (adminFilter === "disabled") {
      return Boolean(admin.isDisabled);
    }
    return !admin.isDisabled;
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

  const formatIdleTime = (remainingMs: number) => {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

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

  const handleStartCategoryEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryOriginalName(category.name);
  };

  const handleSaveCategoryEdit = async () => {
    if (editingCategoryId === null) return;

    try {
      const updated = await updateCategoryBySuperAdmin(editingCategoryId, {
        name: editingCategoryName,
      });
      setCategories(updated);
      await fetchAdmins(setAdmins, () =>
        clearSuperAdminSession(() => router.push("/login")),
      );
      setCreateForm((current) => ({
        ...current,
        unit:
          current.unit === editingCategoryOriginalName
            ? editingCategoryName.trim()
            : current.unit,
      }));
      setEditForm((current) => ({
        ...current,
        unit:
          current.unit === editingCategoryOriginalName
            ? editingCategoryName.trim()
            : current.unit,
      }));
      setEditingCategoryId(null);
      setEditingCategoryName("");
      setEditingCategoryOriginalName("");
      toast.success("Category updated successfully");
    } catch (error) {
      toastApiError(error, "Failed to update category.");
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    try {
      const updated = await deleteCategoryBySuperAdmin(category.id);
      setCategories(updated);
      await fetchAdmins(setAdmins, () =>
        clearSuperAdminSession(() => router.push("/login")),
      );
      setCreateForm((current) => ({
        ...current,
        unit: current.unit === category.name ? "" : current.unit,
      }));
      setEditForm((current) => ({
        ...current,
        unit: current.unit === category.name ? "" : current.unit,
      }));
      if (editingCategoryId === category.id) {
        setEditingCategoryId(null);
        setEditingCategoryName("");
        setEditingCategoryOriginalName("");
      }
      toast.success("Category deleted successfully");
    } catch (error) {
      toastApiError(error, "Failed to delete category.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-slate-50 via-stone-50 to-amber-50">
      <div className="border-b bg-slate-900 text-white">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/80">
                <Shield className="h-3.5 w-3.5" />
                Restricted Console
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Superadmin Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
                Hidden system control for managing admin accounts across all
                units.
              </p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/80 sm:text-sm">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                Inactivity Timer
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-lg font-semibold text-white">
                  {formatIdleTime(idleRemainingMs)}
                </p>
                {isDev ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/30 bg-white/10 text-white hover:bg-white/20"
                    onClick={async () => {
                      try {
                        await logout();
                      } finally {
                        clearSuperAdminSession(() => router.push("/login"));
                      }
                    }}
                  >
                    Expire now
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

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
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Create Admin
                </CardTitle>
                <CardDescription>
                  Provision a new unit admin directly from the control console.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-first-name">First Name</Label>
                    <Input
                      id="create-first-name"
                      value={createForm.firstName}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-last-name">Last Name</Label>
                    <Input
                      id="create-last-name"
                      value={createForm.lastName}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-email">Email</Label>
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
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-password">Temporary Password</Label>
                    <Input
                      id="create-password"
                      type="password"
                      value={createForm.password}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select
                      value={createForm.unit}
                      onValueChange={(value) =>
                        setCreateForm((current) => ({ ...current, unit: value }))
                      }
                    >
                      <SelectTrigger>
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
                  <Button type="submit" className="w-full">
                    Create Admin Account
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Category Control
                </CardTitle>
                <CardDescription>
                  Create or rename categories and sync them across admin units
                  and feedback categories.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  onSubmit={handleCreateCategory}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <Input
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    required
                  />
                  <Button type="submit" variant="secondary">
                    Add
                  </Button>
                </form>

                <div className="space-y-2">
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No categories found.
                    </p>
                  ) : (
                    <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                      {categories
                        .filter((category) => {
                          const name = category.name.trim().toLowerCase();
                          return name !== "disabled" && name !== "inactive";
                        })
                        .map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center gap-2 rounded-md border p-2"
                        >
                          {editingCategoryId === category.id ? (
                            <>
                              <Input
                                value={editingCategoryName}
                                onChange={(event) =>
                                  setEditingCategoryName(event.target.value)
                                }
                              />
                              <Button
                                size="sm"
                                onClick={handleSaveCategoryEdit}
                                type="button"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <p className="flex-1 truncate text-sm">{category.name}</p>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => handleStartCategoryEdit(category)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => handleDeleteCategory(category)}
                                className="border-border text-foreground hover:border-red-600 hover:bg-red-600 hover:text-black"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5" />
                    Admin Control
                  </CardTitle>
                  <CardDescription>
                    Review, modify, and remove admin accounts in the system.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-2 py-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={adminFilter === "active" ? "default" : "ghost"}
                    onClick={() => setAdminFilter("active")}
                    className="h-8 rounded-full px-3 flex-1 sm:flex-none"
                  >
                    Active
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={adminFilter === "disabled" ? "default" : "ghost"}
                    onClick={() => setAdminFilter("disabled")}
                    className="h-8 rounded-full px-3 flex-1 sm:flex-none"
                  >
                    Disabled
                  </Button>
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
                          colSpan={6}
                          className="py-10 text-center text-muted-foreground"
                        >
                          {adminFilter === "disabled"
                            ? "No disabled admin accounts found."
                            : "No active admin accounts found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleAdmins.map((admin) => (
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
                            <Badge
                              variant="outline"
                              className={getUnitClass(admin.unit)}
                            >
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
                                  <Ban className="h-4 w-4 rotate-180" />
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
            </CardContent>
          </Card>
        </div>
      </div>

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
              <Input
                id="edit-password"
                type="password"
                value={editForm.password}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Leave blank to keep current password"
              />
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
              <Input
                id="reauth-password"
                type="password"
                value={reauthPassword}
                onChange={(event) => setReauthPassword(event.target.value)}
              />
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
