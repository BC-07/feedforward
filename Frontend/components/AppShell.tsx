"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  deleteUserAccount,
  logout,
  listFeedbacks,
  updateAdminProfile,
  updateAdminPassword,
  updateUserPassword,
  updateUserProfile,
  type Feedback,
} from "@/lib/api";
import {
  LogOut,
  User,
  UserCircle2,
  Camera,
  Bell,
  MoreVertical,
  Eye,
  EyeOff,
  ChevronDown,
  Menu,
  House,
  ClipboardList,
  Send,
  ListChecks,
  Search,
  ShieldCheck,
  UserCog,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/admin/constants";

const SESSION_EVENT = "feedforward:session-change";
const emailLikePattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function containsEmailLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes("@")) return true;
  return emailLikePattern.test(trimmed);
}

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

type LogoutRole = "user" | "admin" | "superadmin";
type SidebarShortcut = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (path: string) => boolean;
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
      /* eslint-disable-next-line @next/next/no-img-element */
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDesktopSidebarExpanded, setIsDesktopSidebarExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const desktopSidebarRef = useRef<HTMLDivElement>(null);
  const adminAvatarInputRef = useRef<HTMLInputElement>(null);
  const userAvatarInputRef = useRef<HTMLInputElement>(null);
  const [passwordEdit, setPasswordEdit] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [showAdminCurrentPw, setShowAdminCurrentPw] = useState(false);
  const [showAdminNewPw, setShowAdminNewPw] = useState(false);
  const [showAdminConfirmPw, setShowAdminConfirmPw] = useState(false);
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
  const [showUserCurrentPw, setShowUserCurrentPw] = useState(false);
  const [showUserNewPw, setShowUserNewPw] = useState(false);
  const [showUserConfirmPw, setShowUserConfirmPw] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<Feedback[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(
    new Set(),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [logoutConfirmRole, setLogoutConfirmRole] = useState<LogoutRole | null>(null);
  const [isLogoutPending, setIsLogoutPending] = useState(false);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [isDeleteAccountPending, setIsDeleteAccountPending] = useState(false);
  const session = useSyncExternalStore(
    subscribeSessionSnapshot,
    getSessionSnapshot,
    () => emptySessionSnapshot,
  );
  const effectiveSession = isHydrated ? session : emptySessionSnapshot;

  useEffect(() => {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
      "http://localhost:5566";

    const sendLogoutBeacon = () => {
      if (
        !effectiveSession.isAdminLoggedIn &&
        !effectiveSession.isSuperAdminLoggedIn
      ) {
        return;
      }
      if (typeof navigator === "undefined" || !navigator.sendBeacon) {
        return;
      }
      const url = `${apiBase}/auth/logout`;
      const body = new Blob([], { type: "application/json" });
      navigator.sendBeacon(url, body);
    };

    const handleBeforeUnload = () => {
      sendLogoutBeacon();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [effectiveSession.isAdminLoggedIn, effectiveSession.isSuperAdminLoggedIn]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isDesktopSidebarExpanded) return;

    const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const sidebarNode = desktopSidebarRef.current;
      if (!sidebarNode) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (sidebarNode.contains(target)) return;
      setIsDesktopSidebarExpanded(false);
    };

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("touchstart", handleOutsidePointer);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("touchstart", handleOutsidePointer);
    };
  }, [isDesktopSidebarExpanded]);

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
  } = effectiveSession;
  const isAdminSetPasswordRoute = pathname.startsWith("/admin/set-password");
  const shouldShowSidebar =
    !isAdminSetPasswordRoute &&
    (pathname.startsWith("/user") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/superadmin"));
  const topBarHeightClass = "h-16";
  const collapsedSidebarOffsetClass = shouldShowSidebar ? "md:pl-14" : "";

  const saveReadNotificationIds = useCallback(
    (nextSet: Set<string>) => {
      if (typeof window === "undefined") return;
      if (!isAdminLoggedIn || !adminId || !adminUnit) return;
      const key = `adminNotificationsRead:${adminId}:${adminUnit}`;
      localStorage.setItem(key, JSON.stringify(Array.from(nextSet)));
      setReadNotificationIds(new Set(nextSet));
    },
    [adminId, adminUnit, isAdminLoggedIn],
  );

  const refreshAdminNotifications = useCallback(async () => {
    if (!isAdminLoggedIn || !adminUnit) return;
    setIsNotificationsLoading(true);
    try {
      const data = await listFeedbacks({ category: adminUnit });
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const recent = data
        .filter(
          (feedback) => now - new Date(feedback.createdAt).getTime() <= sevenDaysMs,
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 10);
      setAdminNotifications(recent);
      if (readNotificationIds.size > 0) {
        const allowedIds = new Set(recent.map((item) => item.id));
        const nextRead = new Set(
          Array.from(readNotificationIds).filter((id) => allowedIds.has(id)),
        );
        if (nextRead.size !== readNotificationIds.size) {
          saveReadNotificationIds(nextRead);
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load notifications.",
      );
    } finally {
      setIsNotificationsLoading(false);
    }
  }, [adminUnit, isAdminLoggedIn, readNotificationIds, saveReadNotificationIds]);

  const handleNotificationsClearAll = () => {
    if (!window.confirm("Mark all notifications as read?")) return;
    const next = new Set(sortedAdminNotifications.map((item) => item.id));
    saveReadNotificationIds(next);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAdminLoggedIn || !adminId || !adminUnit) return;
    const key = `adminNotificationsRead:${adminId}:${adminUnit}`;
    const stored = localStorage.getItem(key);
    if (!stored) {
      setReadNotificationIds(new Set());
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((id) => typeof id === "string");
        setReadNotificationIds(new Set(ids));
      } else {
        setReadNotificationIds(new Set());
      }
    } catch {
      setReadNotificationIds(new Set());
    }
  }, [isAdminLoggedIn, adminId, adminUnit]);

  useEffect(() => {
    if (!isAdminLoggedIn || !adminUnit) return;
    void refreshAdminNotifications();
  }, [isAdminLoggedIn, adminUnit, refreshAdminNotifications]);

  const toggleNotificationRead = (id: string) => {
    const next = new Set(readNotificationIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    saveReadNotificationIds(next);
  };

  const handleOpenAdminNotification = (feedback: Feedback) => {
    const next = new Set(readNotificationIds);
    if (!next.has(feedback.id)) {
      next.add(feedback.id);
      saveReadNotificationIds(next);
    }
    setIsNotificationsOpen(false);
    router.push(
      `/dashboard/feedback-submission?feedbackId=${encodeURIComponent(
        feedback.id,
      )}&open=${Date.now()}`,
    );
  };

  const sortedAdminNotifications = [...adminNotifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const unreadAdminNotifications = sortedAdminNotifications.filter(
    (feedback) => !readNotificationIds.has(feedback.id),
  );
  const adminNotificationCount = unreadAdminNotifications.length;

  const clearSessionForRole = (role: LogoutRole) => {
    if (role === "user") {
      localStorage.removeItem("isUserLoggedIn");
      localStorage.removeItem("currentUserId");
      localStorage.removeItem("currentUserName");
      localStorage.removeItem("currentUserEmail");
      return;
    }

    if (role === "admin") {
      localStorage.removeItem("isAdminLoggedIn");
      localStorage.removeItem("currentAdminId");
      localStorage.removeItem("currentAdminName");
      localStorage.removeItem("currentAdminEmail");
      localStorage.removeItem("currentAdminDepartment");
      return;
    }

    localStorage.removeItem("isSuperAdminLoggedIn");
    localStorage.removeItem("superAdminName");
    localStorage.removeItem("superAdminExpiresAt");
  };

  const getLogoutSuccessMessage = (role: LogoutRole) => {
    if (role === "user") return "Logged out successfully";
    if (role === "admin") return "Admin logged out successfully";
    return "Superadmin logged out successfully";
  };

  const getLogoutRedirect = (role: LogoutRole) => {
    if (role === "superadmin") return "/login";
    return "/";
  };

  const getLogoutDialogCopy = (role: LogoutRole) => {
    if (role === "user") {
      return {
        title: "Logout your account?",
        description: "You will need to log in again to access your user account.",
      };
    }

    if (role === "admin") {
      return {
        title: "Logout as admin?",
        description: "You will be signed out of the admin dashboard and returned to the homepage.",
      };
    }

    return {
      title: "Logout as superadmin?",
      description: "You will be signed out of the superadmin panel and sent back to the login page.",
    };
  };

  const performLogout = async (role: LogoutRole) => {
    try {
      await logout();
    } catch {
      // Best-effort logout
    }

    clearSessionForRole(role);
    announceSessionChange();
    toast.success(getLogoutSuccessMessage(role));
    router.push(getLogoutRedirect(role));
  };

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
    setLogoutConfirmRole("user");
  };

  const handleAdminLogout = () => {
    setLogoutConfirmRole("admin");
  };

  const handleSuperAdminLogout = () => {
    setLogoutConfirmRole("superadmin");
  };

  const handleLogoutConfirm = async () => {
    if (!logoutConfirmRole || isLogoutPending) return;

    const role = logoutConfirmRole;
    setIsLogoutPending(true);
    try {
      await performLogout(role);
      setLogoutConfirmRole(null);
    } finally {
      setIsLogoutPending(false);
    }
  };

  const handleLogoClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!effectiveSession.isAdminLoggedIn && !effectiveSession.isSuperAdminLoggedIn) {
      return;
    }
    event.preventDefault();
    try {
      await logout();
    } catch {
      // Best-effort logout
    }
    if (effectiveSession.isAdminLoggedIn) {
      clearSessionForRole("admin");
    }
    if (effectiveSession.isSuperAdminLoggedIn) {
      clearSessionForRole("superadmin");
    }
    announceSessionChange();
    router.push("/");
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
      if (containsEmailLike(lastName)) {
        toast.error("Last name must not contain an email");
        return;
      }

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

  const handleDeleteUserAccount = async () => {
    if (isDeleteAccountPending) return;
    setIsDeleteAccountPending(true);
    try {
      await deleteUserAccount(userId);
      setIsDeleteAccountDialogOpen(false);
      await performLogout("user");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account.",
      );
    } finally {
      setIsDeleteAccountPending(false);
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
      if (containsEmailLike(lastName)) {
        toast.error("Last name must not contain an email");
        return;
      }

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

  const logoutDialogCopy = logoutConfirmRole
    ? getLogoutDialogCopy(logoutConfirmRole)
    : null;
  const adminPageTitle =
    pathname === "/dashboard/feedback-submission"
      ? "Feedback Submission"
      : "Admin Dashboard";
  const userPageTitle =
    pathname === "/user/home"
      ? "Home"
      : pathname === "/user/my-submissions"
      ? "My Submissions"
      : pathname === "/user/submit-feedback"
        ? "Submit Feedback"
        : "User";
  const superAdminPageTitle =
    pathname === "/superadmin" || pathname === "/superadmin/admin-dashboard"
      ? "Admin Dashboard"
      : pathname === "/superadmin/admin-control"
        ? "Admin Control"
        : pathname === "/superadmin/category-control"
          ? "Category Control"
          : "Superadmin";
  const sidebarShortcuts: SidebarShortcut[] = isAdminLoggedIn
    ? [
        {
          href: "/dashboard",
          label: "Home",
          icon: House,
          isActive: (path) => path === "/dashboard",
        },
        {
          href: "/dashboard/feedback-submission",
          label: "Feedback Submission ",
          icon: ClipboardList,
          isActive: (path) => path.startsWith("/dashboard/feedback-submission"),
        },
      ]
    : isUserLoggedIn
      ? [
          {
            href: "/user/home",
            label: "Home",
            icon: House,
            isActive: (path) => path === "/user/home",
          },
          {
            href: "/user/my-submissions",
            label: "My Submissions",
            icon: ListChecks,
            isActive: (path) => path === "/user/my-submissions",
          },
        ]
      : isSuperAdminLoggedIn
        ? [
            {
              href: "/superadmin/admin-dashboard",
              label: "Admin Dashboard",
              icon: ShieldCheck,
              isActive: (path) =>
                path === "/superadmin" || path.startsWith("/superadmin/admin-dashboard"),
            },
            {
              href: "/superadmin/admin-control",
              label: "Admin Control",
              icon: UserCog,
              isActive: (path) => path.startsWith("/superadmin/admin-control"),
            },
            {
              href: "/superadmin/category-control",
              label: "Category Control",
              icon: Tag,
              isActive: (path) => path.startsWith("/superadmin/category-control"),
            },
          ]
        : [
            {
              href: "/submit",
              label: "Submit Feedback",
              icon: Send,
              isActive: (path) => path === "/submit",
            },
            {
              href: "/track",
              label: "Track Feedback",
              icon: Search,
              isActive: (path) => path === "/track",
            },
          ];
  const expandedSidebarTitle = "FEED FORWARD";
  const expandedSidebarSubtitle = "SMART. FAST. SAFE.";
  const handleSidebarExpandClick = (
    event?: React.MouseEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>,
  ) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsDesktopSidebarExpanded(true);
  };

  const handleSidebarCollapseClick = (
    event?: React.MouseEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>,
  ) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsDesktopSidebarExpanded(false);
  };

  const AppFooter = () => (
    <footer className="border-t border-muted bg-white mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FeedForward. All rights reserved.</p>
          <p className="mt-1">Making feedback management smart, fast, and safe.</p>
        </div>
      </div>
    </footer>
  );

  return (
    <div className="min-h-[100svh] flex flex-col bg-background">
      {shouldShowSidebar && sidebarShortcuts.length > 0 && (
        <aside className="fixed left-0 top-0 bottom-0 z-[60] hidden md:flex">
          <div
            ref={desktopSidebarRef}
            className={`flex h-full flex-col border-r border-border bg-muted shadow-sm transition-[width] duration-300 ease-out ${
              isDesktopSidebarExpanded ? "backdrop-blur-0" : "backdrop-blur"
            } ${
              isDesktopSidebarExpanded ? "w-60 items-center" : "w-14 items-center"
            }`}
          >
            {isDesktopSidebarExpanded ? (
              <div className={`w-full border-b border-border bg-white px-2 ${topBarHeightClass}`}>
                <div className="flex h-full items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/favicon.ico"
                      alt="FeedForward logo"
                      className="h-8 w-8 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="whitespace-nowrap text-lg font-semibold leading-tight text-foreground">
                        {expandedSidebarTitle}
                      </p>
                      <p className="whitespace-nowrap text-[11px] leading-tight text-muted-foreground">
                        {expandedSidebarSubtitle}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-foreground hover:bg-muted/80"
                    aria-label="Collapse sidebar menu"
                    onPointerDown={handleSidebarCollapseClick}
                    onClick={handleSidebarCollapseClick}
                  >
                    <Menu className="h-4 w-4 text-foreground" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`flex w-full items-center justify-center ${topBarHeightClass}`}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-foreground hover:bg-muted/80"
                  aria-label="Expand sidebar menu"
                  onPointerDown={handleSidebarExpandClick}
                  onClick={handleSidebarExpandClick}
                >
                  <Menu className="h-5 w-5 text-foreground" />
                </Button>
              </div>
            )}
            {sidebarShortcuts.map((item, index) => {
                const Icon = item.icon;
                const active = item.isActive(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => {
                      if (!isDesktopSidebarExpanded) {
                        setIsDesktopSidebarExpanded(true);
                      }
                    }}
                    className={`${isDesktopSidebarExpanded && index === 0 ? "mt-2" : ""} mb-0.5 flex h-10 items-center justify-center rounded-lg border transition-all duration-300 ${
                      isDesktopSidebarExpanded
                        ? "mx-auto w-[calc(100%-1.5rem)] justify-start px-4"
                        : "w-9 justify-center"
                    } ${
                      active
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span
                      className={`overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-200 ${
                        isDesktopSidebarExpanded
                          ? "ml-3 max-w-[180px] opacity-100"
                          : "ml-0 max-w-0 opacity-0"
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
          </div>
        </aside>
      )}

      {/* Header */}
      <header
        className={`sticky top-0 z-50 border-b border-border bg-white ${collapsedSidebarOffsetClass}`}
      >
        <div className={`container mx-auto px-4 ${topBarHeightClass}`}>
          <div className="flex h-full items-center justify-between">
            <div className="flex items-center gap-3">
              {shouldShowSidebar && (
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 md:hidden"
                      aria-label="Open sidebar menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="z-[80] w-[320px] sm:max-w-sm md:hidden"
                  >
                    <SheetHeader>
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/favicon.ico"
                          alt="FeedForward logo"
                          className="h-9 w-9"
                        />
                        <div className="text-left">
                          <SheetTitle className="text-lg tracking-tight">
                            FEED FORWARD
                          </SheetTitle>
                          <SheetDescription className="text-xs">
                            SMART. FAST. SAFE.
                          </SheetDescription>
                        </div>
                      </div>
                    </SheetHeader>
                    <div className="px-4 pb-4">
                      {isAdminLoggedIn && (
                        <>
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-accent"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <House className="h-4 w-4" />
                            <span>Admin Dashboard</span>
                          </Link>
                          <div className="h-px bg-border" />
                          <Link
                            href="/dashboard/feedback-submission"
                            className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-accent"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <ClipboardList className="h-4 w-4" />
                            <span>Feedback Submission</span>
                          </Link>
                        </>
                      )}

                      {isUserLoggedIn && !isAdminLoggedIn && (
                        <>
                          <Link
                            href="/user/home"
                            className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-accent"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <House className="h-4 w-4" />
                            <span>Home</span>
                          </Link>
                          <div className="h-px bg-border" />
                          <Link
                            href="/user/my-submissions"
                            className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-accent"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <ListChecks className="h-4 w-4" />
                            <span>My Submissions</span>
                          </Link>
                        </>
                      )}

                      {isSuperAdminLoggedIn && !isAdminLoggedIn && !isUserLoggedIn && (
                        <>
                          <Link
                            href="/superadmin/admin-dashboard"
                            className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-accent"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>Admin Dashboard</span>
                          </Link>
                          <div className="h-px bg-border" />
                          <Link
                            href="/superadmin/admin-control"
                            className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-accent"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <UserCog className="h-4 w-4" />
                            <span>Admin Control</span>
                          </Link>
                          <div className="h-px bg-border" />
                          <Link
                            href="/superadmin/category-control"
                            className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-accent"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <Tag className="h-4 w-4" />
                            <span>Category Control</span>
                          </Link>
                        </>
                      )}

                      {!isAdminLoggedIn && !isUserLoggedIn && !isSuperAdminLoggedIn && (
                        <>
                          <Link
                            href="/submit"
                            className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-accent"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <Send className="h-4 w-4" />
                            <span>Submit Feedback</span>
                          </Link>
                          <div className="h-px bg-border" />
                          <Link
                            href="/track"
                            className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-accent"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <Search className="h-4 w-4" />
                            <span>Track Feedback</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              )}

              <Link
                href="/"
                className="flex items-center gap-2"
                onClick={handleLogoClick}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/favicon.ico"
                  alt="FeedForward logo"
                  className="h-8 w-8"
                />
                <div>
                  <h1 className="text-xl font-bold text-primary tracking-tight">
                    {isDashboardRoute && isAdminLoggedIn
                      ? adminPageTitle
                      : isUserLoggedIn && pathname.startsWith("/user")
                        ? userPageTitle
                        : isSuperAdminLoggedIn && pathname.startsWith("/superadmin")
                          ? superAdminPageTitle
                        : "FEED FORWARD"}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {isDashboardRoute && isAdminLoggedIn
                      ? adminUnit || "Admin"
                      : isUserLoggedIn && pathname.startsWith("/user")
                        ? ""
                        : isSuperAdminLoggedIn && pathname.startsWith("/superadmin")
                          ? "Superadmin"
                        : "SMART. FAST. SAFE."}
                  </p>
                </div>
              </Link>
            </div>

            {/* Public nav */}
            {!isDashboardRoute && !isSuperAdminRoute && (
              <nav className="flex items-center gap-6">
                {isUserLoggedIn ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-3 rounded-full px-2.5 py-1.5 transition-colors hover:bg-muted/60"
                        aria-label="Open user menu"
                      >
                        <AvatarDisplay src={userAvatar} fallback={<User />} size="sm" accentColor="accent" />
                        <div className="hidden sm:flex flex-col items-start leading-tight">
                          <span className="text-sm font-semibold text-foreground">
                            {session.userName || "User"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            User
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      forceMount
                      className="w-44 ff-dropdown-anim"
                    >
                      <DropdownMenuItem onClick={() => setIsUserProfileOpen(true)}>
                        <User className="mr-2 h-4 w-4 text-foreground" />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleUserLogout}
                        className="group text-destructive focus:text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
                      >
                        <LogOut className="mr-2 h-4 w-4 group-hover:text-destructive-foreground group-focus:text-destructive-foreground" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <>
                  </>
                )}
              </nav>
            )}

            {/* Admin nav */}
            {isDashboardRoute && isAdminLoggedIn && (
              <div className="flex items-center gap-2">
                <Sheet
                  open={isNotificationsOpen}
                  onOpenChange={(open) => {
                    setIsNotificationsOpen(open);
                    if (open) {
                      void refreshAdminNotifications();
                    }
                  }}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative"
                      aria-label="Open notifications"
                    >
                      <Bell className="h-5 w-5" />
                      {adminNotificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold flex items-center justify-center px-1">
                          {adminNotificationCount > 99 ? "99+" : adminNotificationCount}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                <SheetContent
                  className="w-[360px] sm:w-[400px] overflow-hidden rounded-l-3xl ff-sheet-anim"
                  onInteractOutside={(event) => {
                    event.preventDefault();
                  }}
                >
                  <SheetHeader className="px-3 pb-0 pt-4">
                    <SheetTitle className="text-center text-lg font-semibold">
                      Notifications
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      Recent feedback notifications. Select an item to open it in the feedback submission page.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-0.5 flex items-center justify-end px-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleNotificationsClearAll}
                      disabled={sortedAdminNotifications.length === 0}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="mt-2 flex-1 min-h-0 space-y-3 overflow-y-auto px-3 pr-4 pb-3">
                    {isNotificationsLoading ? (
                      <div className="text-sm text-muted-foreground">
                        Loading notifications...
                      </div>
                      ) : sortedAdminNotifications.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          You&apos;re all caught up. No new feedback yet.
                        </div>
                      ) : (
                        sortedAdminNotifications.slice(0, 12).map((feedback) => {
                          const isRead = readNotificationIds.has(feedback.id);
                          return (
                          <div
                            role="button"
                            tabIndex={0}
                            key={feedback.id}
                            onClick={(event) => {
                              const target = event.target as HTMLElement | null;
                              if (target?.closest("[data-notification-action='true']")) {
                                return;
                              }
                              handleOpenAdminNotification(feedback);
                            }}
                            onKeyDown={(event) => {
                              const target = event.target as HTMLElement | null;
                              if (target?.closest("[data-notification-action='true']")) {
                                return;
                              }
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleOpenAdminNotification(feedback);
                              }
                            }}
                            className={`w-full text-left rounded-lg border border-border/40 border-l-4 bg-white/80 p-3 shadow-sm cursor-pointer transition-all duration-200 ease-out hover:bg-white hover:border-border/70 hover:shadow-[0_0_0_1px_rgba(255,149,0,0.18),0_8px_20px_-12px_rgba(0,0,0,0.35)] hover:scale-[1.01] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                              feedback.priority?.toLowerCase() === "high"
                                ? "border-l-orange-400"
                                : feedback.priority?.toLowerCase() === "medium"
                                  ? "border-l-amber-400"
                                  : feedback.priority?.toLowerCase() === "low"
                                    ? "border-l-slate-300"
                                    : "border-l-muted-foreground/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold text-sm text-left">
                                {feedback.subject}
                              </p>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={isRead ? "secondary" : "default"}
                                  className="whitespace-nowrap"
                                >
                                  {isRead ? "Read" : "Unread"}
                                </Badge>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      aria-label="Notification actions"
                                      data-notification-action="true"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    data-notification-action="true"
                                  >
                                    <DropdownMenuItem
                                      data-notification-action="true"
                                      onSelect={(event) => {
                                        event.stopPropagation();
                                        toggleNotificationRead(feedback.id);
                                      }}
                                    >
                                      {isRead ? "Mark as unread" : "Mark as read"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-3">
                              <p className="text-xs text-muted-foreground">
                                {feedback.category} • {feedback.type}
                              </p>
                              <div className="flex items-center justify-end gap-2">
                                <Badge
                                  variant="outline"
                                  className="h-6 px-2 text-xs capitalize whitespace-nowrap"
                                >
                                  {feedback.status}
                                </Badge>
                                {feedback.priority && (
                                  <Badge
                                    variant="outline"
                                    className={`h-6 px-2 text-xs whitespace-nowrap border ${
                                      feedback.priority.toLowerCase() === "high"
                                        ? "bg-orange-50 text-orange-700 border-orange-200"
                                        : feedback.priority.toLowerCase() === "medium"
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-slate-50 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    {feedback.priority} Priority
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {new Date(feedback.createdAt).toLocaleString("en-US")}
                            </div>
                          </div>
                          );
                        })
                      )}
                      {sortedAdminNotifications.length > 12 && (
                        <p className="text-xs text-muted-foreground">
                          Showing 12 most recent feedback items.
                        </p>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-3 rounded-full px-2.5 py-1.5 transition-colors hover:bg-muted/60"
                      aria-label="Open admin menu"
                    >
                      <AvatarDisplay
                        src={adminAvatar}
                        fallback={<UserCircle2 />}
                        size="sm"
                        accentColor="primary"
                      />
                      <div className="hidden sm:flex flex-col items-start leading-tight">
                        <span className="text-sm font-semibold text-foreground">
                          {session.adminName || "Admin"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {session.adminUnit || "Admin"}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    forceMount
                    className="w-44 ff-dropdown-anim"
                  >
                    <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                      <UserCircle2 className="mr-2 h-4 w-4 text-foreground" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleAdminLogout}
                      className="group text-destructive focus:text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
                    >
                      <LogOut className="mr-2 h-4 w-4 group-hover:text-destructive-foreground group-focus:text-destructive-foreground" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {isSuperAdminRoute && isSuperAdminLoggedIn && (
              <div className="flex items-center gap-3">
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

      <main className={`flex-1 flex flex-col ${collapsedSidebarOffsetClass}`}>
        <div key={pathname} className="page-fade">
          {children}
        </div>
      </main>

      {/* Footer */}
      <div className={collapsedSidebarOffsetClass}>
        <AppFooter />
      </div>

      {/* Logout Confirmation */}
      <AlertDialog
        open={logoutConfirmRole !== null}
        onOpenChange={(open) => {
          if (!open && !isLogoutPending) {
            setLogoutConfirmRole(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{logoutDialogCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {logoutDialogCopy?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLogoutPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isLogoutPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleLogoutConfirm();
              }}
            >
              {isLogoutPending ? "Logging out..." : "Logout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteAccountDialogOpen}
        onOpenChange={(open) => {
          if (!isDeleteAccountPending) {
            setIsDeleteAccountDialogOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. Your account and related access will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleteAccountPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleteAccountPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUserAccount();
              }}
            >
              {isDeleteAccountPending ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin Profile Sheet */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent
          className="w-[360px] sm:w-[400px] overflow-y-auto rounded-l-3xl ff-sheet-anim"
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
        >
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
                  name="firstName"
                  autoComplete="given-name"
                  placeholder="Enter first name"
                  value={adminProfileEdit.firstName}
                  onChange={(e) => setAdminProfileEdit({ ...adminProfileEdit, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adm-lname" className="text-xs text-muted-foreground">Last Name</Label>
                <Input
                  id="adm-lname"
                  name="lastName"
                  autoComplete="family-name"
                  placeholder="Enter last name"
                  value={adminProfileEdit.lastName}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAdminProfileEdit({ ...adminProfileEdit, lastName: next });
                  }}
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
                <div className="relative">
                  <Input
                    id="adm-curpw"
                    type={showAdminCurrentPw ? "text" : "password"}
                    placeholder="Enter current password"
                    value={passwordEdit.current}
                    onChange={(e) => setPasswordEdit({ ...passwordEdit, current: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAdminCurrentPw((prev) => !prev)}
                    aria-label={showAdminCurrentPw ? "Hide password" : "Show password"}
                  >
                    {showAdminCurrentPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adm-newpw" className="text-xs text-muted-foreground">New Password</Label>
                <div className="relative">
                  <Input
                    id="adm-newpw"
                    type={showAdminNewPw ? "text" : "password"}
                    placeholder="Enter new password"
                    value={passwordEdit.next}
                    onChange={(e) => setPasswordEdit({ ...passwordEdit, next: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAdminNewPw((prev) => !prev)}
                    aria-label={showAdminNewPw ? "Hide password" : "Show password"}
                  >
                    {showAdminNewPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adm-confpw" className="text-xs text-muted-foreground">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="adm-confpw"
                    type={showAdminConfirmPw ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={passwordEdit.confirm}
                    onChange={(e) => setPasswordEdit({ ...passwordEdit, confirm: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAdminConfirmPw((prev) => !prev)}
                    aria-label={showAdminConfirmPw ? "Hide password" : "Show password"}
                  >
                    {showAdminConfirmPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button className="w-full" variant="outline" onClick={handlePasswordChange}>
                Update Password
              </Button>
            </div>

          </div>
        </SheetContent>
      </Sheet>

      {/* ── User Profile Sheet ──────────────────────────────────────────── */}
      <Sheet open={isUserProfileOpen} onOpenChange={setIsUserProfileOpen}>
        <SheetContent className="mobile-profile-sheet w-[360px] max-w-[92vw] sm:w-[400px] overflow-y-auto rounded-l-3xl data-[state=open]:duration-1500 data-[state=closed]:duration-1000 data-[state=open]:ease-out data-[state=closed]:ease-in sm:data-[state=open]:duration-500 sm:data-[state=closed]:duration-300 ff-sheet-anim">
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
                  name="firstName"
                  autoComplete="given-name"
                  placeholder="Enter first name"
                  value={userProfileEdit.firstName}
                  onChange={(e) => setUserProfileEdit({ ...userProfileEdit, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-lname" className="text-xs text-muted-foreground">Last Name</Label>
                <Input
                  id="u-lname"
                  name="lastName"
                  autoComplete="family-name"
                  placeholder="Enter last name"
                  value={userProfileEdit.lastName}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (containsEmailLike(next)) {
                      toast.error("Last name must not contain an email");
                      return;
                    }
                    setUserProfileEdit({ ...userProfileEdit, lastName: next });
                  }}
                />
              </div>
            </div>

            <div className="space-y-3 border rounded-2xl p-4">
              <p className="text-sm font-semibold">Change Password</p>
              <div className="space-y-2">
                <Label htmlFor="u-curpw" className="text-xs text-muted-foreground">Current Password</Label>
                <div className="relative">
                  <Input
                    id="u-curpw"
                    type={showUserCurrentPw ? "text" : "password"}
                    placeholder="Enter current password"
                    value={userProfileEdit.currentPassword}
                    onChange={(e) => setUserProfileEdit({ ...userProfileEdit, currentPassword: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowUserCurrentPw((prev) => !prev)}
                    aria-label={showUserCurrentPw ? "Hide password" : "Show password"}
                  >
                    {showUserCurrentPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-newpw" className="text-xs text-muted-foreground">New Password</Label>
                <div className="relative">
                  <Input
                    id="u-newpw"
                    type={showUserNewPw ? "text" : "password"}
                    placeholder="Enter new password"
                    value={userProfileEdit.newPassword}
                    onChange={(e) => setUserProfileEdit({ ...userProfileEdit, newPassword: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowUserNewPw((prev) => !prev)}
                    aria-label={showUserNewPw ? "Hide password" : "Show password"}
                  >
                    {showUserNewPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-confpw" className="text-xs text-muted-foreground">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="u-confpw"
                    type={showUserConfirmPw ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={userProfileEdit.confirmPassword}
                    onChange={(e) => setUserProfileEdit({ ...userProfileEdit, confirmPassword: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowUserConfirmPw((prev) => !prev)}
                    aria-label={showUserConfirmPw ? "Hide password" : "Show password"}
                  >
                    {showUserConfirmPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleUserProfileSave}>
              Save Changes
            </Button>

            <div className="pt-2 border-t pb-6">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setIsDeleteAccountDialogOpen(true)}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
