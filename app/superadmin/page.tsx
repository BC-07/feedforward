"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoryBySuperAdmin,
  createAdminBySuperAdmin,
  disableAdminBySuperAdmin,
  deleteCategoryBySuperAdmin,
  listAdmins,
  listCategories,
  logoutSuperAdmin,
  updateCategoryBySuperAdmin,
  updateAdminBySuperAdmin,
  type Admin,
  type Category,
} from "@/frontend/api";
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

const emptyCreateForm = {
  firstName: "",
  lastName: "",
  email: "",
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
  superAdminId: string,
  onSuccess: (admins: Admin[]) => void,
  onAuthFailure: () => void,
) {
  try {
    const data = await listAdmins(superAdminId);
    startTransition(() => {
      onSuccess(data);
    });
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load admins.";
    toast.error(message);
    if (message.toLowerCase().includes("superadmin")) {
      onAuthFailure();
    }
    return false;
  }
}

async function clearSuperAdminSession(onRedirect: () => void) {
  try {
    await logoutSuperAdmin();
  } catch {
    // no-op
  }

  localStorage.removeItem("isSuperAdminLoggedIn");
  localStorage.removeItem("superAdminId");
  localStorage.removeItem("superAdminName");
  onRedirect();
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [superAdminId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : localStorage.getItem("superAdminId") || "",
  );
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

  const stats = {
    total: admins.length,
    occupiedUnits: new Set(admins.map((admin) => admin.unit)).size,
    latestUpdate:
      admins
        .map((admin) => new Date(admin.updatedAt).getTime())
        .sort((a, b) => b - a)[0] ?? null,
  };

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isLoggedIn = localStorage.getItem("isSuperAdminLoggedIn") === "true";
    const sessionAdminId = localStorage.getItem("superAdminId") || "";

    if (!isLoggedIn || !sessionAdminId) {
      router.push("/login");
      return;
    }

    void fetchAdmins(sessionAdminId, setAdmins, () =>
      void clearSuperAdminSession(() => router.push("/login")),
    );
    void listCategories()
      .then((data: Category[]) => {
        setCategories(data);
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to load categories.",
        );
      });
  }, [router]);

  const handleCreateAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!superAdminId) return;

    try {
      await createAdminBySuperAdmin(superAdminId, createForm);
      setCreateForm(emptyCreateForm);
      await fetchAdmins(superAdminId, setAdmins, () =>
        void clearSuperAdminSession(() => router.push("/login")),
      );
      toast.success("Admin created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create admin.",
      );
    }
  };

  const handleOpenEdit = (admin: Admin) => {
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

  const handleUpdateAdmin = async () => {
    if (!superAdminId || !selectedAdmin) return;

    try {
      await updateAdminBySuperAdmin(superAdminId, selectedAdmin.id, editForm);
      setIsEditOpen(false);
      setSelectedAdmin(null);
      setEditForm(emptyEditForm);
      await fetchAdmins(superAdminId, setAdmins, () =>
        void clearSuperAdminSession(() => router.push("/login")),
      );
      toast.success("Admin updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update admin.",
      );
    }
  };

  const handleDisableAdmin = async (admin: Admin) => {
    if (!superAdminId) return;
    if (!window.confirm(`Disable admin access for ${admin.name}?`)) return;

    try {
      await disableAdminBySuperAdmin(superAdminId, admin.id);
      await fetchAdmins(superAdminId, setAdmins, () =>
        void clearSuperAdminSession(() => router.push("/login")),
      );
      toast.success("Admin account disabled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to disable admin.",
      );
    }
  };

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!superAdminId) return;

    try {
      const updated = await createCategoryBySuperAdmin(superAdminId, {
        name: newCategoryName,
      });
      setCategories(updated);
      setNewCategoryName("");
      toast.success("Category created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create category.",
      );
    }
  };

  const handleStartCategoryEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryOriginalName(category.name);
  };

  const handleSaveCategoryEdit = async () => {
    if (!superAdminId || editingCategoryId === null) return;

    try {
      const updated = await updateCategoryBySuperAdmin(superAdminId, editingCategoryId, {
        name: editingCategoryName,
      });
      setCategories(updated);
      await fetchAdmins(superAdminId, setAdmins, () =>
        void clearSuperAdminSession(() => router.push("/login")),
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
      toast.error(
        error instanceof Error ? error.message : "Failed to update category.",
      );
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!superAdminId) return;
    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    try {
      const updated = await deleteCategoryBySuperAdmin(superAdminId, category.id);
      setCategories(updated);
      await fetchAdmins(superAdminId, setAdmins, () =>
  		void clearSuperAdminSession(() => router.push("/login")),
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
      toast.error(
        error instanceof Error ? error.message : "Failed to delete category.",
      );
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-slate-50 via-stone-50 to-amber-50">
      <div className="border-b bg-slate-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/80">
                <Shield className="h-3.5 w-3.5" />
                Restricted Console
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Superadmin Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Hidden system control for managing admin accounts across all
                units.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
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
                  ? new Date(stats.latestUpdate).toLocaleString()
                  : "No updates yet"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Most recent admin record update time
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Create Admin
                </CardTitle>
                <CardDescription>
                  Provision a new unit admin. A 6-character temporary password is
                  auto-generated and emailed with a direct change-password link.
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
                        {categories.map((category) => (
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
                <form onSubmit={handleCreateCategory} className="flex gap-2">
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
                      {categories.map((category) => (
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
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Admin Control
              </CardTitle>
              <CardDescription>
                Review, modify, and remove admin accounts in the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No admin accounts found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      admins.map((admin) => (
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
                            <Badge
                              variant="outline"
                              className={getStatusClass(admin.isDisabled)}
                            >
                              {admin.isDisabled ? "Disabled" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(admin.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(admin)}
                                className="border-transparent bg-transparent text-black hover:bg-amber-600 hover:text-black"
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDisableAdmin(admin)}
                                disabled={Boolean(admin.isDisabled)}
                                className="border-transparent bg-transparent text-black hover:bg-red-600 hover:text-black disabled:opacity-60"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                {admin.isDisabled ? "Disabled" : "Disable"}
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
                  {categories.map((category) => (
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
    </div>
  );
}