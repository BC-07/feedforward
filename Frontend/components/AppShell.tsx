"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  deleteAdminAccount,
  deleteUserAccount,
  updateAdminProfile,
  updateAdminPassword,
  updateUserPassword,
  updateUserProfile,
} from "@/lib/api";
import { ArrowRight, LogOut, User, UserCircle2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const SESSION_EVENT = "feedforward:session-change";

type SessionSnapshot = {
  isUserLoggedIn: boolean;
  isAdminLoggedIn: boolean;
  isSuperAdminLoggedIn: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminUnit: string;
  adminAvatar: string;
  superAdminName: string;
};

const emptySessionSnapshot: SessionSnapshot = {
  isUserLoggedIn: false,
  isAdminLoggedIn: false,
  isSuperAdminLoggedIn: false,
  userId: "",
  userName: "",
  userEmail: "",
  userAvatar: "",
  adminId: "",
  adminName: "",
  adminEmail: "",
  adminUnit: "",
  adminAvatar: "",
  superAdminName: "superadmin",
};

let cachedSessionSnapshot: SessionSnapshot | null = null;

function readSessionSnapshotFromStorage(): SessionSnapshot {
  const userId = localStorage.getItem("currentUserId") || "";
  const adminId = localStorage.getItem("currentAdminId") || "";

  return {
    isUserLoggedIn: localStorage.getItem("isUserLoggedIn") === "true",
    isAdminLoggedIn: localStorage.getItem("isAdminLoggedIn") === "true",
    isSuperAdminLoggedIn: localStorage.getItem("isSuperAdminLoggedIn") === "true",
    userId,
    userName: localStorage.getItem("currentUserName") || "",
    userEmail: localStorage.getItem("currentUserEmail") || "",
    userAvatar: userId ? localStorage.getItem(`userAvatar_${userId}`) || "" : "",
    adminId,
    adminName: localStorage.getItem("currentAdminName") || "",
    adminEmail: localStorage.getItem("currentAdminEmail") || "",
    adminUnit: localStorage.getItem("currentAdminDepartment") || "",
    adminAvatar: adminId
      ? localStorage.getItem(`adminAvatar_${adminId}`) || ""
      : "",
    superAdminName: localStorage.getItem("superAdminName") || "superadmin",
  };
}

function isSameSnapshot(a: SessionSnapshot, b: SessionSnapshot): boolean {
  return (
    a.isUserLoggedIn === b.isUserLoggedIn &&
    a.isAdminLoggedIn === b.isAdminLoggedIn &&
    a.isSuperAdminLoggedIn === b.isSuperAdminLoggedIn &&
    a.userId === b.userId &&
    a.userName === b.userName &&
    a.userEmail === b.userEmail &&
    a.userAvatar === b.userAvatar &&
    a.adminId === b.adminId &&
    a.adminName === b.adminName &&
    a.adminEmail === b.adminEmail &&
    a.adminUnit === b.adminUnit &&
    a.adminAvatar === b.adminAvatar &&
    a.superAdminName === b.superAdminName
  );
}

function getSessionSnapshot(): SessionSnapshot {
  if (typeof window === "undefined") {
    return emptySessionSnapshot;
  }

  const nextSnapshot = readSessionSnapshotFromStorage();
  if (cachedSessionSnapshot && isSameSnapshot(cachedSessionSnapshot, nextSnapshot)) {
    return cachedSessionSnapshot;
  }

  cachedSessionSnapshot = nextSnapshot;
  return nextSnapshot;
}

function subscribeSessionSnapshot(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(SESSION_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(SESSION_EVENT, handler);
  };
}

function announceSessionChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
}

// ── Reusable Avatar component ──────────────────────────────────────────────
const AvatarDisplay = ({
  src,
  fallback,
  size = "lg",
  accentColor = "primary",
}: {
  src: string;
  fallback: React.ReactNode;
  size?: "sm" | "lg";
  accentColor?: "primary" | "accent";
}) => {
  const dim = size === "lg" ? "h-20 w-20" : "h-8 w-8";
  const iconDim = size === "lg" ? "h-10 w-10" : "h-4 w-4";
  const bg = accentColor === "primary" ? "bg-primary/10" : "bg-accent/10";
  const text = accentColor === "primary" ? "text-primary" : "text-accent";

  if (src) {
    return (
      <img
        src={src}
        alt="Profile"
        className={`${dim} rounded-full object-cover border-2 border-border`}
      />
    );
  }

  return (
    <div className={`${dim} rounded-full ${bg} flex items-center justify-center`}>
      <div className={`${iconDim} ${text} flex items-center justify-center`}>
        {fallback}
      </div>
    </div>
  );
};

// ── Main AppShell ──────────────────────────────────────────────────────────
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isSuperAdminRoute = pathname.startsWith("/superadmin");
  const adminAvatarInputRef = useRef<HTMLInputElement>(null);
  const userAvatarInputRef = useRef<HTMLInputElement>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [passwordEdit, setPasswordEdit] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [adminProfileEdit, setAdminProfileEdit] = useState({
    firstName: "",
    lastName: "",
  });

  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [userProfileEdit, setUserProfileEdit] = useState({
    firstName: "",
    lastName: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const session = useSyncExternalStore(
    subscribeSessionSnapshot,
    getSessionSnapshot,
    () => emptySessionSnapshot,
  );
  const effectiveSession = isHydrated ? session : emptySessionSnapshot;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const {
    isUserLoggedIn,
    isAdminLoggedIn,
    isSuperAdminLoggedIn,
    userId,
    userName,
    userEmail,
    userAvatar,
    adminId,
    adminName,
    adminEmail,
    adminUnit,
    adminAvatar,
    superAdminName,
  } = effectiveSession;

  // ── Avatar upload handlers ───────────────────────────────────────────────
  const handleAdminAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      localStorage.setItem(`adminAvatar_${adminId}`, base64);
      announceSessionChange();
      toast.success("Profile photo updated!");
    };
    reader.readAsDataURL(file);
  };

  const handleUserAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      localStorage.setItem(`userAvatar_${userId}`, base64);
      announceSessionChange();
      toast.success("Profile photo updated!");
    };
    reader.readAsDataURL(file);
  };

  // ── Auth / profile handlers ──────────────────────────────────────────────
  const handleUserLogout = () => {
    localStorage.removeItem("isUserLoggedIn");
    localStorage.removeItem("currentUserId");
    localStorage.removeItem("currentUserName");
    localStorage.removeItem("currentUserEmail");
    announceSessionChange();
    toast.success("Logged out successfully");
    router.push("/");
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("currentAdminId");
    localStorage.removeItem("currentAdminName");
    localStorage.removeItem("currentAdminEmail");
    localStorage.removeItem("currentAdminDepartment");
    announceSessionChange();
    toast.success("Admin logged out successfully");
    router.push("/");
  };

  const handleSuperAdminLogout = () => {
    localStorage.removeItem("isSuperAdminLoggedIn");
    localStorage.removeItem("superAdminToken");
    localStorage.removeItem("superAdminName");
    localStorage.removeItem("superAdminExpiresAt");
    announceSessionChange();
    toast.success("Superadmin logged out successfully");
    router.push("/login");
  };

  const handlePasswordChange = async () => {
    if (!passwordEdit.current || !passwordEdit.next || !passwordEdit.confirm) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (passwordEdit.next.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (passwordEdit.next !== passwordEdit.confirm) {
      toast.error("New passwords do not match");
      return;
    }

    try {
      await updateAdminPassword(adminId, {
        currentPassword: passwordEdit.current,
        newPassword: passwordEdit.next,
      });
      setPasswordEdit({ current: "", next: "", confirm: "" });
      toast.success("Password updated successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update password.",
      );
    }
  };

  const handleAdminProfileSave = async () => {
    try {
      const currentNameParts = adminName.trim().split(/\s+/);
      const firstName =
        adminProfileEdit.firstName.trim() || currentNameParts[0] || "";
      const lastName =
        adminProfileEdit.lastName.trim() ||
        currentNameParts.slice(1).join(" ") ||
        "";

      const updatedAdmin = await updateAdminProfile(adminId, {
        firstName,
        lastName,
      });

      localStorage.setItem("currentAdminName", updatedAdmin.name);
      setAdminProfileEdit({
        firstName: "",
        lastName: "",
      });
      announceSessionChange();
      toast.success("Admin profile updated!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile.",
      );
    }
  };

  const handleDeleteAdminAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your admin account? This cannot be undone.")) return;
    try {
      await deleteAdminAccount(adminId);
      handleAdminLogout();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete admin account.",
      );
    }
  };

  const handleDeleteUserAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
    try {
      await deleteUserAccount(userId);
      handleUserLogout();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account.",
      );
    }
  };

  const handleUserProfileSave = async () => {
    if (userProfileEdit.newPassword || userProfileEdit.currentPassword) {
      if (userProfileEdit.newPassword.length < 6) {
        toast.error("New password must be at least 6 characters");
        return;
      }
      if (userProfileEdit.newPassword !== userProfileEdit.confirmPassword) {
        toast.error("New passwords do not match");
        return;
      }
    }

    try {
      const currentNameParts = userName.trim().split(/\s+/);
      const firstName =
        userProfileEdit.firstName.trim() || currentNameParts[0] || "";
      const lastName =
        userProfileEdit.lastName.trim() ||
        currentNameParts.slice(1).join(" ") ||
        "";

      const updatedUser = await updateUserProfile(userId, {
        firstName,
        lastName,
      });

      if (userProfileEdit.newPassword) {
        await updateUserPassword(userId, {
          currentPassword: userProfileEdit.currentPassword,
          newPassword: userProfileEdit.newPassword,
        });
      }

      localStorage.setItem("currentUserName", updatedUser.name);
      setUserProfileEdit({
        firstName: "",
        lastName: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      announceSessionChange();
      toast.success("Profile updated!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <ArrowRight className="h-8 w-8 text-accent" />
              <div>
                <h1 className="text-xl font-bold text-primary tracking-tight">FEED FORWARD</h1>
                <p className="text-xs text-muted-foreground">SMART. FAST. SAFE.</p>
              </div>
            </Link>

            {/* Public nav */}
            {!isDashboardRoute && !isSuperAdminRoute && (
              <nav className="flex items-center gap-6">
                {isUserLoggedIn ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsUserProfileOpen(true)}
                      className="flex items-center gap-2 text-sm hover:text-accent transition-colors"
                    >
                      <AvatarDisplay src={userAvatar} fallback={<User />} size="sm" accentColor="accent" />
                      <span className="font-medium">{userName}</span>
                    </button>
                    <Button variant="ghost" size="sm" onClick={handleUserLogout} className="text-sm">
                      <LogOut className="h-4 w-4 mr-1" />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <>
                    <Link href="/submit" className="text-sm hover:text-accent transition-colors">
                      Submit Feedback
                    </Link>
                    <Link href="/track" className="text-sm hover:text-accent transition-colors">
                      Track Submission
                    </Link>
                    <Link
                      href="/login"
                      className="text-sm bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors"
                    >
                      LogIn
                    </Link>
                  </>
                )}
              </nav>
            )}

            {/* Admin nav */}
{isDashboardRoute && isAdminLoggedIn && (
  <div className="flex items-center gap-3">
    <button
      onClick={() => setIsProfileOpen(true)}
      className="flex items-center gap-2 text-sm hover:text-accent transition-colors"
    >
      <AvatarDisplay src={adminAvatar} fallback={<UserCircle2 />} size="sm" accentColor="primary" />
      <span className="font-medium">{adminName}</span>
    </button>
    <Button variant="ghost" size="sm" onClick={handleAdminLogout} className="text-sm">
      <LogOut className="h-4 w-4 mr-1" />
      Logout
    </Button>
  </div>
)}
            {isSuperAdminRoute && isSuperAdminLoggedIn && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <UserCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">{superAdminName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSuperAdminLogout}
                  className="text-sm"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-white mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} FeedForward. All rights reserved.</p>
            <p className="mt-1">Making feedback management smart, fast, and safe.</p>
          </div>
        </div>
      </footer>

      {/* ── Admin Profile Sheet ─────────────────────────────────────────── */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent className="w-[360px] sm:w-[400px] overflow-y-auto rounded-l-3xl">
          <SheetHeader className="px-2 flex items-center justify-center text-center">
            <SheetTitle className="text-center w-full">Admin Profile</SheetTitle>
            <SheetDescription className="text-center w-full">Your account information</SheetDescription>
          </SheetHeader>
          <div className="mt-8 space-y-6 px-3 pb-8">
            <div className="flex flex-col items-center gap-3 pb-6 border-b">

              {/* Admin Avatar */}
              <div className="relative group mx-auto w-20 h-20">
                <AvatarDisplay src={adminAvatar} fallback={<UserCircle2 />} size="lg" accentColor="primary" />
                <button
                  onClick={() => adminAvatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
                <input
                  ref={adminAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAdminAvatarChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">Hover photo to change</p>

              <div className="text-center">
                <p className="text-xl font-bold">{adminName}</p>
                <p className="text-sm text-muted-foreground">{adminUnit}</p>
              </div>
            </div>

            <div className="space-y-3 border rounded-2xl p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Full Name</span>
                <span className="font-medium">{adminName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium truncate max-w-[180px]">{adminEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit</span>
                <span className="font-medium">{adminUnit}</span>
              </div>
            </div>

            <div className="space-y-3 border rounded-2xl p-4">
              <p className="text-sm font-semibold">Change Name</p>
              <div className="space-y-2">
                <Label htmlFor="adm-fname" className="text-xs text-muted-foreground">First Name</Label>
                <Input
                  id="adm-fname"
                  placeholder="Enter first name"
                  value={adminProfileEdit.firstName}
                  onChange={(e) => setAdminProfileEdit({ ...adminProfileEdit, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adm-lname" className="text-xs text-muted-foreground">Last Name</Label>
                <Input
                  id="adm-lname"
                  placeholder="Enter last name"
                  value={adminProfileEdit.lastName}
                  onChange={(e) => setAdminProfileEdit({ ...adminProfileEdit, lastName: e.target.value })}
                />
              </div>
              <Button className="w-full" variant="outline" onClick={handleAdminProfileSave}>
                Save Name
              </Button>
            </div>

            <div className="space-y-3 border rounded-2xl p-4">
              <p className="text-sm font-semibold">Change Password</p>
              <div className="space-y-2">
                <Label htmlFor="adm-curpw" className="text-xs text-muted-foreground">Current Password</Label>
                <Input
                  id="adm-curpw"
                  type="password"
                  placeholder="Enter current password"
                  value={passwordEdit.current}
                  onChange={(e) => setPasswordEdit({ ...passwordEdit, current: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adm-newpw" className="text-xs text-muted-foreground">New Password</Label>
                <Input
                  id="adm-newpw"
                  type="password"
                  placeholder="Enter new password"
                  value={passwordEdit.next}
                  onChange={(e) => setPasswordEdit({ ...passwordEdit, next: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adm-confpw" className="text-xs text-muted-foreground">Confirm New Password</Label>
                <Input
                  id="adm-confpw"
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordEdit.confirm}
                  onChange={(e) => setPasswordEdit({ ...passwordEdit, confirm: e.target.value })}
                />
              </div>
              <Button className="w-full" variant="outline" onClick={handlePasswordChange}>
                Update Password
              </Button>
            </div>

            <div className="pt-2 border-t pb-6">
              <Button variant="destructive" className="w-full" onClick={handleDeleteAdminAccount}>
                Delete Account
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── User Profile Sheet ──────────────────────────────────────────── */}
      <Sheet open={isUserProfileOpen} onOpenChange={setIsUserProfileOpen}>
        <SheetContent className="w-[360px] sm:w-[400px] overflow-y-auto rounded-l-3xl">
          <SheetHeader className="px-2 flex items-center justify-center text-center">
            <SheetTitle className="text-center w-full">My Profile</SheetTitle>
            <SheetDescription className="text-center w-full">View and update your account</SheetDescription>
          </SheetHeader>
          <div className="mt-8 space-y-6 px-3 pb-8">
            <div className="flex flex-col items-center gap-3 pb-6 border-b">

              {/* User Avatar */}
              <div className="relative group mx-auto w-20 h-20">
                <AvatarDisplay src={userAvatar} fallback={<User />} size="lg" accentColor="accent" />
                <button
                  onClick={() => userAvatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
                <input
                  ref={userAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUserAvatarChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">Hover photo to change</p>

              <div className="text-center">
                <p className="text-xl font-bold">{userName}</p>
                <p className="text-sm text-muted-foreground">{userEmail}</p>
              </div>
            </div>

            <div className="space-y-3 border rounded-2xl p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Full Name</span>
                <span className="font-medium">{userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium truncate max-w-[180px]">{userEmail}</span>
              </div>
            </div>

            <div className="space-y-3 border rounded-2xl p-4">
              <p className="text-sm font-semibold">Change Name</p>
              <div className="space-y-2">
                <Label htmlFor="u-fname" className="text-xs text-muted-foreground">First Name</Label>
                <Input
                  id="u-fname"
                  placeholder="Enter first name"
                  value={userProfileEdit.firstName}
                  onChange={(e) => setUserProfileEdit({ ...userProfileEdit, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-lname" className="text-xs text-muted-foreground">Last Name</Label>
                <Input
                  id="u-lname"
                  placeholder="Enter last name"
                  value={userProfileEdit.lastName}
                  onChange={(e) => setUserProfileEdit({ ...userProfileEdit, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3 border rounded-2xl p-4">
              <p className="text-sm font-semibold">Change Password</p>
              <div className="space-y-2">
                <Label htmlFor="u-curpw" className="text-xs text-muted-foreground">Current Password</Label>
                <Input
                  id="u-curpw"
                  type="password"
                  placeholder="Enter current password"
                  value={userProfileEdit.currentPassword}
                  onChange={(e) => setUserProfileEdit({ ...userProfileEdit, currentPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-newpw" className="text-xs text-muted-foreground">New Password</Label>
                <Input
                  id="u-newpw"
                  type="password"
                  placeholder="Enter new password"
                  value={userProfileEdit.newPassword}
                  onChange={(e) => setUserProfileEdit({ ...userProfileEdit, newPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-confpw" className="text-xs text-muted-foreground">Confirm New Password</Label>
                <Input
                  id="u-confpw"
                  type="password"
                  placeholder="Confirm new password"
                  value={userProfileEdit.confirmPassword}
                  onChange={(e) => setUserProfileEdit({ ...userProfileEdit, confirmPassword: e.target.value })}
                />
              </div>
            </div>

            <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleUserProfileSave}>
              Save Changes
            </Button>

            <div className="pt-2 border-t pb-6">
              <Button variant="destructive" className="w-full" onClick={handleDeleteUserAccount}>
                Delete Account
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
