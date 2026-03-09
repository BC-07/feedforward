"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAdminBySuperAdmin,
  deleteAdminBySuperAdmin,
  listAdmins,
  updateAdminBySuperAdmin,
  type Admin,
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
import { Shield, UserCog, UserPlus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const UNITS = [
  "IT Unit",
  "Finance & Registrar Office",
  "Student Affair Office",
  "Guidance Office",
  "Faculty Office",
];

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
  sessionToken: string,
  onSuccess: (admins: Admin[]) => void,
  onAuthFailure: () => void,
) {
  try {
    const data = await listAdmins(sessionToken);
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

function clearSuperAdminSession(onRedirect: () => void) {
  localStorage.removeItem("isSuperAdminLoggedIn");
  localStorage.removeItem("superAdminToken");
  localStorage.removeItem("superAdminName");
  localStorage.removeItem("superAdminExpiresAt");
  onRedirect();
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [token] = useState(() =>
    typeof window === "undefined"
      ? ""
      : localStorage.getItem("superAdminToken") || "",
  );
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const stats = {
    total: admins.length,
    occupiedUnits: new Set(admins.map((admin) => admin.unit)).size,
    latestUpdate:
      admins
        .map((admin) => new Date(admin.updatedAt).getTime())
        .sort((a, b) => b - a)[0] ?? null,
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isLoggedIn = localStorage.getItem("isSuperAdminLoggedIn") === "true";
    const sessionToken = localStorage.getItem("superAdminToken") || "";
    const expiresAt = localStorage.getItem("superAdminExpiresAt") || "";

    if (!isLoggedIn || !sessionToken) {
      router.push("/login");
      return;
    }

    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      clearSuperAdminSession(() => router.push("/login"));
      toast.error("Superadmin session expired.");
      return;
    }

    void fetchAdmins(sessionToken, setAdmins, () =>
      clearSuperAdminSession(() => router.push("/login")),
    );
  }, [router]);

  const handleCreateAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      await createAdminBySuperAdmin(token, createForm);
      setCreateForm(emptyCreateForm);
      await fetchAdmins(token, setAdmins, () =>
        clearSuperAdminSession(() => router.push("/login")),
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
    if (!token || !selectedAdmin) return;

    try {
      await updateAdminBySuperAdmin(token, selectedAdmin.id, editForm);
      setIsEditOpen(false);
      setSelectedAdmin(null);
      setEditForm(emptyEditForm);
      await fetchAdmins(token, setAdmins, () =>
        clearSuperAdminSession(() => router.push("/login")),
      );
      toast.success("Admin updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update admin.",
      );
    }
  };

  const handleDeleteAdmin = async (admin: Admin) => {
    if (!token) return;
    if (!window.confirm(`Delete admin account for ${admin.name}?`)) return;

    try {
      await deleteAdminBySuperAdmin(token, admin.id);
      await fetchAdmins(token, setAdmins, () =>
        clearSuperAdminSession(() => router.push("/login")),
      );
      toast.success("Admin deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete admin.",
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
                      {UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
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
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
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
                            <Badge variant="secondary">{admin.unit}</Badge>
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
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteAdmin(admin)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
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
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
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
