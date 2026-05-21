"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LogOut, User, UserCircle2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

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

  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminUnit, setAdminUnit] = useState("");
  const [adminId, setAdminId] = useState("");

  const [adminAvatar, setAdminAvatar] = useState<string>("");
  const [userAvatar, setUserAvatar] = useState<string>("");
  const adminAvatarInputRef = useRef<HTMLInputElement>(null);
  const userAvatarInputRef = useRef<HTMLInputElement>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [passwordEdit, setPasswordEdit] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userProfileEdit, setUserProfileEdit] = useState({
    firstName: "",
    lastName: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const userLoggedIn = localStorage.getItem("isUserLoggedIn") === "true";
    const adminLoggedIn = localStorage.getItem("isAdminLoggedIn") === "true";

    setIsUserLoggedIn(userLoggedIn);
    setIsAdminLoggedIn(adminLoggedIn);

    if (userLoggedIn) {
      const uid = localStorage.getItem("currentUserId") || "";
      setUserName(localStorage.getItem("currentUserName") || "");
      setUserId(uid);
      setUserEmail(localStorage.getItem("currentUserEmail") || "");
      setUserAvatar(localStorage.getItem(`userAvatar_${uid}`) || "");
    }
    if (adminLoggedIn) {
      const aid = localStorage.getItem("currentAdminId") || "";
      setAdminName(localStorage.getItem("currentAdminName") || "");
      setAdminEmail(localStorage.getItem("currentAdminEmail") || "");
      setAdminUnit(localStorage.getItem("currentAdminDepartment") || "");
      setAdminId(aid);
      setAdminAvatar(localStorage.getItem(`adminAvatar_${aid}`) || "");
    }
  }, [pathname]);

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
      setAdminAvatar(base64);
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
      setUserAvatar(base64);
      toast.success("Profile photo updated!");
    };
    reader.readAsDataURL(file);
  };

  // ── Auth / profile handlers ──────────────────────────────────────────────
  const handleUserLogout = () => {
    localStorage.removeItem("isUserLoggedIn");
    localStorage.removeItem("currentUserId");
    localStorage.removeItem("currentUserName");
    setIsUserLoggedIn(false);
    setUserName("");
    toast.success("Logged out successfully");
    router.push("/");
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("currentAdminId");
    localStorage.removeItem("currentAdminName");
    localStorage.removeItem("currentAdminEmail");
    localStorage.removeItem("currentAdminDepartment");
    setIsAdminLoggedIn(false);
    setAdminName("");
    toast.success("Admin logged out successfully");
    router.push("/");
  };

  const handlePasswordChange = () => {
    if (!passwordEdit.current || !passwordEdit.next || !passwordEdit.confirm) {
      toast.error("Please fill in all password fields");
      return;
    }
    const admins = JSON.parse(localStorage.getItem("admins") || "[]");
    const admin = admins.find((a: any) => a.id === adminId);
    if (!admin || admin.password !== passwordEdit.current) {
      toast.error("Current password is incorrect");
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
    const updatedAdmins = admins.map((a: any) =>
      a.id === adminId ? { ...a, password: passwordEdit.next } : a,
    );
    localStorage.setItem("admins", JSON.stringify(updatedAdmins));
    setPasswordEdit({ current: "", next: "", confirm: "" });
    toast.success("Password updated successfully!");
  };

  const handleDeleteAdminAccount = () => {
    if (!window.confirm("Are you sure you want to delete your admin account? This cannot be undone.")) return;
    const admins = JSON.parse(localStorage.getItem("admins") || "[]");
    const updated = admins.filter((a: any) => a.id !== adminId);
    localStorage.setItem("admins", JSON.stringify(updated));
    handleAdminLogout();
  };

  const handleDeleteUserAccount = () => {
    if (!window.confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const updated = users.filter((u: any) => u.id !== userId);
    localStorage.setItem("users", JSON.stringify(updated));
    handleUserLogout();
  };

  const handleUserProfileSave = () => {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const idx = users.findIndex((u: any) => u.id === userId);
    if (idx === -1) return;

    if (userProfileEdit.newPassword || userProfileEdit.currentPassword) {
      if (users[idx].password !== userProfileEdit.currentPassword) {
        toast.error("Current password is incorrect");
        return;
      }
      if (userProfileEdit.newPassword.length < 6) {
        toast.error("New password must be at least 6 characters");
        return;
      }
      if (userProfileEdit.newPassword !== userProfileEdit.confirmPassword) {
        toast.error("New passwords do not match");
        return;
      }
      users[idx].password = userProfileEdit.newPassword;
    }

    const existingName = users[idx].name || "";
    const parts = existingName.split(" ");
    const firstName = userProfileEdit.firstName.trim() || users[idx].firstName || parts[0] || "";
    const lastName = userProfileEdit.lastName.trim() || users[idx].lastName || parts.slice(1).join(" ") || "";
    const fullName = `${firstName} ${lastName}`.trim();
    users[idx] = { ...users[idx], name: fullName, firstName, lastName };
    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("currentUserName", fullName);
    setUserName(fullName);
    setUserProfileEdit({
      firstName: "",
      lastName: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    toast.success("Profile updated!");
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
            {!isDashboardRoute && (
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