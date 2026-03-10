"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAdminBySuperAdmin,
  createCategoryBySuperAdmin,
  deleteCategoryBySuperAdmin,
  disableAdminBySuperAdmin,
  listAdmins,
  listCategories,
  updateAdminBySuperAdmin,
  updateCategoryBySuperAdmin,
  type Admin,
  type Category,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Ban, Loader2, LogOut, MoreHorizontal, Pencil, Save, Shield, Tag, Trash2, UserCog, UserPlus } from "lucide-react";
import { ActionButton } from "@/components/ux/action-button";
import { AccountStatusBadge, RoleBadge, UnitBadge } from "@/components/ux/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/ux/async-state";
import { FieldError, RequiredMark } from "@/components/ux/form-feedback";

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

type AdminFormErrors = Partial<Record<keyof typeof emptyCreateForm, string>>;

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [token] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("superAdminToken") || "",
  );
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [createErrors, setCreateErrors] = useState<AdminFormErrors>({});
  const [editErrors, setEditErrors] = useState<AdminFormErrors>({});
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryError, setNewCategoryError] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryOriginalName, setEditingCategoryOriginalName] = useState("");
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [adminsError, setAdminsError] = useState("");
  const [categoriesError, setCategoriesError] = useState("");
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [pendingDisableIds, setPendingDisableIds] = useState<string[]>([]);
  const [pendingDeleteCategoryIds, setPendingDeleteCategoryIds] = useState<number[]>([]);

  const disableTimersRef = useRef<Record<string, number>>({});
  const deleteCategoryTimersRef = useRef<Record<number, number>>({});

  const stats = useMemo(
    () => ({
      total: admins.length,
      occupiedUnits: new Set(admins.map((admin) => admin.unit)).size,
      latestUpdate:
        admins
          .map((admin) => new Date(admin.updatedAt).getTime())
          .sort((a, b) => b - a)[0] ?? null,
    }),
    [admins],
  );

  const clearSuperAdminSession = useCallback(() => {
    localStorage.removeItem("isSuperAdminLoggedIn");
    localStorage.removeItem("superAdminToken");
    localStorage.removeItem("superAdminName");
    localStorage.removeItem("superAdminExpiresAt");
    router.push("/login");
  }, [router]);

  const loadAdmins = useCallback(async (sessionToken: string) => {
    setIsLoadingAdmins(true);
    setAdminsError("");
    try {
      setAdmins(await listAdmins(sessionToken));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load admins.";
      setAdminsError(message);
      if (message.toLowerCase().includes("superadmin")) {
        clearSuperAdminSession();
      }
    } finally {
      setIsLoadingAdmins(false);
    }
  }, [clearSuperAdminSession]);

  const loadCategories = async () => {
    setIsLoadingCategories(true);
    setCategoriesError("");
    try {
      setCategories(await listCategories());
    } catch (error) {
      setCategoriesError(error instanceof Error ? error.message : "Failed to load categories.");
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isLoggedIn = localStorage.getItem("isSuperAdminLoggedIn") === "true";
    const sessionToken = localStorage.getItem("superAdminToken") || "";
    const expiresAt = localStorage.getItem("superAdminExpiresAt") || "";

    if (!isLoggedIn || !sessionToken) {
      router.push("/login");
      return;
    }
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      clearSuperAdminSession();
      toast.error("Superadmin session expired.");
      return;
    }

    void Promise.all([loadAdmins(sessionToken), loadCategories()]);
  }, [clearSuperAdminSession, loadAdmins, router]);

  useEffect(
    () => () => {
      Object.values(disableTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      Object.values(deleteCategoryTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    },
    [],
  );

  const validateAdminForm = (value: typeof emptyCreateForm, requirePassword: boolean): AdminFormErrors => {
    const errors: AdminFormErrors = {};
    if (!value.firstName.trim()) errors.firstName = "First name is required.";
    if (!value.lastName.trim()) errors.lastName = "Last name is required.";
    if (!value.email.trim()) errors.email = "Email is required.";
    if (!value.unit.trim()) errors.unit = "Please select a unit.";
    if (requirePassword && value.password.trim().length < 6) errors.password = "Password must be at least 6 characters.";
    if (!requirePassword && value.password.trim() && value.password.trim().length < 6) errors.password = "New password must be at least 6 characters.";
    return errors;
  };

  const handleCreateAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const normalized = {
      firstName: createForm.firstName.trim(),
      lastName: createForm.lastName.trim(),
      email: createForm.email.trim(),
      password: createForm.password.trim(),
      unit: createForm.unit.trim(),
    };
    const errors = validateAdminForm(normalized, true);
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsCreatingAdmin(true);
    try {
      await createAdminBySuperAdmin(token, normalized);
      setCreateForm(emptyCreateForm);
      await loadAdmins(token);
      toast.success("Admin created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create admin.");
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleUpdateAdmin = async () => {
    if (!token || !selectedAdmin) return;
    const normalized = {
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      email: editForm.email.trim(),
      password: editForm.password.trim(),
      unit: editForm.unit.trim(),
    };
    const errors = validateAdminForm(normalized, false);
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsUpdatingAdmin(true);
    try {
      await updateAdminBySuperAdmin(token, selectedAdmin.id, {
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        email: normalized.email,
        unit: normalized.unit,
        ...(normalized.password ? { password: normalized.password } : {}),
      });
      setIsEditOpen(false);
      setSelectedAdmin(null);
      setEditForm(emptyEditForm);
      await loadAdmins(token);
      toast.success("Admin updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update admin.");
    } finally {
      setIsUpdatingAdmin(false);
    }
  };

  const handleDisableAdmin = (admin: Admin) => {
    if (!token || admin.isDisabled || pendingDisableIds.includes(admin.id)) return;
    if (!window.confirm(`Disable admin access for ${admin.name}?`)) return;

    const previousAdmins = admins;
    setPendingDisableIds((current) => [...current, admin.id]);
    setAdmins((current) => current.map((item) => (item.id === admin.id ? { ...item, isDisabled: true } : item)));

    const timerId = window.setTimeout(async () => {
      try {
        await disableAdminBySuperAdmin(token, admin.id);
        await loadAdmins(token);
        toast.success(`${admin.name} disabled.`);
      } catch (error) {
        setAdmins(previousAdmins);
        toast.error(error instanceof Error ? error.message : "Failed to disable admin.");
      } finally {
        delete disableTimersRef.current[admin.id];
        setPendingDisableIds((current) => current.filter((id) => id !== admin.id));
      }
    }, 4000);

    disableTimersRef.current[admin.id] = timerId;
    toast("Disable queued for 4 seconds.", {
      action: {
        label: "Undo",
        onClick: () => {
          window.clearTimeout(disableTimersRef.current[admin.id]);
          delete disableTimersRef.current[admin.id];
          setAdmins(previousAdmins);
          setPendingDisableIds((current) => current.filter((id) => id !== admin.id));
          toast.success("Disable cancelled.");
        },
      },
    });
  };

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const name = newCategoryName.trim();
    if (!name) {
      setNewCategoryError("Category name is required.");
      return;
    }
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      setNewCategoryError("Category already exists.");
      return;
    }

    setIsCreatingCategory(true);
    setNewCategoryError("");
    try {
      setCategories(await createCategoryBySuperAdmin(token, { name }));
      setNewCategoryName("");
      toast.success("Category created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create category.");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSaveCategoryEdit = async () => {
    if (!token || editingCategoryId === null) return;
    const trimmedName = editingCategoryName.trim();
    if (!trimmedName) {
      toast.error("Category name is required.");
      return;
    }

    const previousCategories = categories;
    setIsSavingCategory(true);
    setCategories((current) => current.map((category) => (category.id === editingCategoryId ? { ...category, name: trimmedName } : category)));
    try {
      setCategories(await updateCategoryBySuperAdmin(token, editingCategoryId, { name: trimmedName }));
      await loadAdmins(token);
      setCreateForm((current) => ({ ...current, unit: current.unit === editingCategoryOriginalName ? trimmedName : current.unit }));
      setEditForm((current) => ({ ...current, unit: current.unit === editingCategoryOriginalName ? trimmedName : current.unit }));
      setEditingCategoryId(null);
      setEditingCategoryName("");
      setEditingCategoryOriginalName("");
      toast.success("Category updated.");
    } catch (error) {
      setCategories(previousCategories);
      toast.error(error instanceof Error ? error.message : "Failed to update category.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = (category: Category) => {
    if (!token || pendingDeleteCategoryIds.includes(category.id)) return;
    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    const previousCategories = categories;
    const previousCreateForm = createForm;
    const previousEditForm = editForm;
    setPendingDeleteCategoryIds((current) => [...current, category.id]);
    setCategories((current) => current.filter((item) => item.id !== category.id));
    setCreateForm((current) => ({ ...current, unit: current.unit === category.name ? "" : current.unit }));
    setEditForm((current) => ({ ...current, unit: current.unit === category.name ? "" : current.unit }));

    const timerId = window.setTimeout(async () => {
      try {
        setCategories(await deleteCategoryBySuperAdmin(token, category.id));
        await loadAdmins(token);
        toast.success("Category deleted.");
      } catch (error) {
        setCategories(previousCategories);
        setCreateForm(previousCreateForm);
        setEditForm(previousEditForm);
        toast.error(error instanceof Error ? error.message : "Failed to delete category.");
      } finally {
        delete deleteCategoryTimersRef.current[category.id];
        setPendingDeleteCategoryIds((current) => current.filter((id) => id !== category.id));
      }
    }, 4000);

    deleteCategoryTimersRef.current[category.id] = timerId;
    toast("Category delete queued for 4 seconds.", {
      action: {
        label: "Undo",
        onClick: () => {
          window.clearTimeout(deleteCategoryTimersRef.current[category.id]);
          delete deleteCategoryTimersRef.current[category.id];
          setCategories(previousCategories);
          setCreateForm(previousCreateForm);
          setEditForm(previousEditForm);
          setPendingDeleteCategoryIds((current) => current.filter((id) => id !== category.id));
          toast.success("Delete cancelled.");
        },
      },
    });
  };

  return (
    <div className="ff-page-shell">
      <div className="border-b bg-slate-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/80">
                <Shield className="h-3.5 w-3.5" />
                Restricted Console
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Superadmin Dashboard</h1>
              <p className="mt-2 text-sm text-white/70">Manage admins and shared categories.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="ff-surface"><CardHeader className="pb-3"><CardDescription>Total Admins</CardDescription><CardTitle className="text-3xl">{stats.total}</CardTitle></CardHeader></Card>
          <Card className="ff-surface"><CardHeader className="pb-3"><CardDescription>Occupied Units</CardDescription><CardTitle className="text-3xl">{stats.occupiedUnits}</CardTitle></CardHeader></Card>
          <Card className="ff-surface"><CardHeader className="pb-3"><CardDescription>Latest Change</CardDescription><CardTitle className="text-lg">{stats.latestUpdate ? new Date(stats.latestUpdate).toLocaleString() : "No updates yet"}</CardTitle></CardHeader></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="ff-surface h-fit">
              <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Create Admin</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="create-first-name">First Name <RequiredMark /></Label><Input id="create-first-name" value={createForm.firstName} onChange={(event) => { setCreateForm((current) => ({ ...current, firstName: event.target.value })); setCreateErrors((current) => ({ ...current, firstName: "" })); }} aria-invalid={Boolean(createErrors.firstName)} /><FieldError message={createErrors.firstName} /></div>
                  <div className="space-y-2"><Label htmlFor="create-last-name">Last Name <RequiredMark /></Label><Input id="create-last-name" value={createForm.lastName} onChange={(event) => { setCreateForm((current) => ({ ...current, lastName: event.target.value })); setCreateErrors((current) => ({ ...current, lastName: "" })); }} aria-invalid={Boolean(createErrors.lastName)} /><FieldError message={createErrors.lastName} /></div>
                  <div className="space-y-2"><Label htmlFor="create-email">Email <RequiredMark /></Label><Input id="create-email" type="email" value={createForm.email} onChange={(event) => { setCreateForm((current) => ({ ...current, email: event.target.value })); setCreateErrors((current) => ({ ...current, email: "" })); }} aria-invalid={Boolean(createErrors.email)} /><FieldError message={createErrors.email} /></div>
                  <div className="space-y-2"><Label htmlFor="create-password">Temporary Password <RequiredMark /></Label><Input id="create-password" type="password" value={createForm.password} onChange={(event) => { setCreateForm((current) => ({ ...current, password: event.target.value })); setCreateErrors((current) => ({ ...current, password: "" })); }} aria-invalid={Boolean(createErrors.password)} /><FieldError message={createErrors.password} /></div>
                  <div className="space-y-2">
                    <Label>Unit <RequiredMark /></Label>
                    <Select value={createForm.unit} onValueChange={(value) => { setCreateForm((current) => ({ ...current, unit: value })); setCreateErrors((current) => ({ ...current, unit: "" })); }}>
                      <SelectTrigger aria-invalid={Boolean(createErrors.unit)}><SelectValue placeholder="Select a unit" /></SelectTrigger>
                      <SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FieldError message={createErrors.unit} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isCreatingAdmin}>{isCreatingAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Admin Account</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="ff-surface h-fit">
              <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" />Category Control</CardTitle><CardDescription>Add, rename, or remove shared categories.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleCreateCategory} className="space-y-2">
                  <div className="flex gap-2"><Input placeholder="New category name" value={newCategoryName} onChange={(event) => { setNewCategoryName(event.target.value); setNewCategoryError(""); }} aria-invalid={Boolean(newCategoryError)} /><Button type="submit" variant="secondary" disabled={isCreatingCategory}>{isCreatingCategory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add</Button></div>
                  <FieldError message={newCategoryError} />
                </form>
                {isLoadingCategories ? <LoadingState label="Loading categories..." /> : categoriesError ? <ErrorState message={categoriesError} onRetry={() => { void loadCategories(); }} /> : categories.length === 0 ? <EmptyState title="No categories found" message="Create your first category." /> : (
                  <div className="grid max-h-48 gap-2 overflow-y-auto pr-1">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center gap-2 rounded-lg border px-2 py-2">
                        {editingCategoryId === category.id ? (
                          <>
                            <Input value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} />
                            <Button size="sm" type="button" onClick={handleSaveCategoryEdit} disabled={isSavingCategory}>{isSavingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button>
                          </>
                        ) : (
                          <>
                            <p className="flex-1 truncate text-sm">{category.name}</p>
                            <ActionButton action="edit" icon={<Pencil className="h-4 w-4" />} label="" className="h-8 w-8 px-0" type="button" onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); setEditingCategoryOriginalName(category.name); }} aria-label={`Edit category ${category.name}`} />
                            <ActionButton action="delete" icon={<Trash2 className="h-4 w-4" />} label="" className="h-8 w-8 px-0" type="button" onClick={() => handleDeleteCategory(category)} disabled={pendingDeleteCategoryIds.includes(category.id)} aria-label={`Delete category ${category.name}`} />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="ff-surface">
            <CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />Admin Control</CardTitle><CardDescription>Review and manage admin accounts. Disabled accounts remain in records.</CardDescription></CardHeader>
            <CardContent>
              {isLoadingAdmins ? <LoadingState label="Loading admin accounts..." /> : adminsError ? <ErrorState message={adminsError} onRetry={() => { if (token) void loadAdmins(token); }} /> : admins.length === 0 ? <EmptyState title="No admins yet" message="Create an admin account to get started." /> : (
                <>
                  <div className="hidden md:block ff-table-shell">
                    <Table>
                      <TableHeader className="ff-table-header"><TableRow className="ff-table-row"><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Unit</TableHead><TableHead>Status</TableHead><TableHead>Role</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {admins.map((admin) => {
                          const isPending = pendingDisableIds.includes(admin.id);
                          return (
                            <TableRow key={admin.id} className="ff-table-row">
                              <TableCell><p className="font-medium">{admin.name}</p><p className="text-xs text-muted-foreground">{admin.id}</p></TableCell>
                              <TableCell>{admin.email}</TableCell>
                              <TableCell><UnitBadge unit={admin.unit} /></TableCell>
                              <TableCell><AccountStatusBadge disabled={admin.isDisabled || isPending} /></TableCell>
                              <TableCell><RoleBadge role="admin" /></TableCell>
                              <TableCell>{new Date(admin.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell className="text-right"><div className="flex justify-end gap-2"><ActionButton action="edit" icon={<Pencil className="h-4 w-4" />} label="Edit" onClick={() => { setSelectedAdmin(admin); setEditForm({ firstName: admin.firstName, lastName: admin.lastName, email: admin.email, password: "", unit: admin.unit }); setEditErrors({}); setIsEditOpen(true); }} aria-label={`Edit ${admin.name}`} /><ActionButton action="disable" icon={<Ban className="h-4 w-4" />} label={admin.isDisabled ? "Disabled" : isPending ? "Queued" : "Disable"} onClick={() => handleDisableAdmin(admin)} disabled={Boolean(admin.isDisabled) || isPending} aria-label={`Disable ${admin.name}`} /></div></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {admins.map((admin) => {
                      const isPending = pendingDisableIds.includes(admin.id);
                      return (
                        <Card key={admin.id} className="ff-surface">
                          <CardContent className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div><p className="font-medium">{admin.name}</p><p className="text-xs text-muted-foreground">{admin.email}</p></div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Open actions for ${admin.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setSelectedAdmin(admin); setEditForm({ firstName: admin.firstName, lastName: admin.lastName, email: admin.email, password: "", unit: admin.unit }); setEditErrors({}); setIsEditOpen(true); }}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDisableAdmin(admin)} disabled={Boolean(admin.isDisabled) || isPending}><Ban className="mr-2 h-4 w-4" />{admin.isDisabled ? "Disabled" : "Disable"}</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex flex-wrap gap-2"><UnitBadge unit={admin.unit} /><AccountStatusBadge disabled={admin.isDisabled || isPending} /><RoleBadge role="admin" /></div>
                            <p className="text-xs text-muted-foreground">Created {new Date(admin.createdAt).toLocaleDateString()}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Admin</DialogTitle><DialogDescription>Update account details and save to the database.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="edit-first-name">First Name <RequiredMark /></Label><Input id="edit-first-name" value={editForm.firstName} onChange={(event) => { setEditForm((current) => ({ ...current, firstName: event.target.value })); setEditErrors((current) => ({ ...current, firstName: "" })); }} aria-invalid={Boolean(editErrors.firstName)} /><FieldError message={editErrors.firstName} /></div>
            <div className="space-y-2"><Label htmlFor="edit-last-name">Last Name <RequiredMark /></Label><Input id="edit-last-name" value={editForm.lastName} onChange={(event) => { setEditForm((current) => ({ ...current, lastName: event.target.value })); setEditErrors((current) => ({ ...current, lastName: "" })); }} aria-invalid={Boolean(editErrors.lastName)} /><FieldError message={editErrors.lastName} /></div>
            <div className="space-y-2"><Label htmlFor="edit-email">Email <RequiredMark /></Label><Input id="edit-email" type="email" value={editForm.email} onChange={(event) => { setEditForm((current) => ({ ...current, email: event.target.value })); setEditErrors((current) => ({ ...current, email: "" })); }} aria-invalid={Boolean(editErrors.email)} /><FieldError message={editErrors.email} /></div>
            <div className="space-y-2"><Label htmlFor="edit-password">New Password</Label><Input id="edit-password" type="password" value={editForm.password} onChange={(event) => { setEditForm((current) => ({ ...current, password: event.target.value })); setEditErrors((current) => ({ ...current, password: "" })); }} placeholder="Leave blank to keep current password" aria-invalid={Boolean(editErrors.password)} /><FieldError message={editErrors.password} /></div>
            <div className="space-y-2">
              <Label>Unit <RequiredMark /></Label>
              <Select value={editForm.unit} onValueChange={(value) => { setEditForm((current) => ({ ...current, unit: value })); setEditErrors((current) => ({ ...current, unit: "" })); }}>
                <SelectTrigger aria-invalid={Boolean(editErrors.unit)}><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>)}</SelectContent>
              </Select>
              <FieldError message={editErrors.unit} />
            </div>
            <Button onClick={handleUpdateAdmin} className="w-full" disabled={isUpdatingAdmin}>{isUpdatingAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Admin Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
