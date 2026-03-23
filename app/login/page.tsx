"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogIn, Mail, Lock, KeyRound } from "lucide-react";
import {
  loginUser,
  loginAdmin,
  superAdminLogin,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
} from "@/frontend/api";

function clearSessionCookies() {
  document.cookie = "ff_user_session=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "ff_admin_session=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "ff_superadmin_session=; Path=/; Max-Age=0; SameSite=Lax";
}

function setSessionCookie(name: "ff_user_session" | "ff_admin_session" | "ff_superadmin_session", maxAge: number) {
  clearSessionCookies();
  document.cookie = `${name}=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [superAdminKey, setSuperAdminKey] = useState("");
  const [isSuperAdminLoading, setIsSuperAdminLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isResetCodeVerified, setIsResetCodeVerified] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [isVerifyResetCodeLoading, setIsVerifyResetCodeLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  useEffect(() => {
    const isUserLoggedIn = localStorage.getItem("isUserLoggedIn") === "true";
    const currentUserId = localStorage.getItem("currentUserId");
    if (isUserLoggedIn && currentUserId) {
      router.replace("/user");
    }
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setShowSuperAdmin((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSuperAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSuperAdminLoading(true);
    try {
      const res = await superAdminLogin(superAdminKey);
      const { token, name, expiresAt } = res.data;
      localStorage.setItem("isSuperAdminLoggedIn", "true");
      localStorage.setItem("superAdminToken", token);
      localStorage.setItem("superAdminName", name);
      localStorage.setItem("superAdminExpiresAt", expiresAt);
      const expiresMs = new Date(expiresAt).getTime() - Date.now();
      const maxAge = Math.max(0, Math.floor(expiresMs / 1000));
      setSessionCookie("ff_superadmin_session", maxAge);
      toast.success(`Welcome, ${name}!`);
      router.push("/superadmin");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid access key");
    } finally {
      setIsSuperAdminLoading(false);
      setSuperAdminKey("");
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    if (!normalizedEmail || !normalizedPassword) {
      toast.error("Email and password are required.");
      return;
    }

    setIsLoading(true);

    try {
      const userRes = await loginUser({ email: normalizedEmail, password: normalizedPassword });
      const user = userRes.data;
      localStorage.setItem("isUserLoggedIn", "true");
      localStorage.setItem("currentUserId", user.id);
      localStorage.setItem("currentUserName", user.name);
      localStorage.setItem("currentUserEmail", user.email);
      setSessionCookie("ff_user_session", 60 * 60 * 24 * 7);
      toast.success(`Welcome back, ${user.name}!`);
      router.push("/user");
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Request failed";
      if (message !== "Invalid email or password") {
        toast.error(message);
        setIsLoading(false);
        return;
      }
    }

    try {
      const adminRes = await loginAdmin({ email: normalizedEmail, password: normalizedPassword });
      const admin = adminRes.data;
      localStorage.setItem("isAdminLoggedIn", "true");
      localStorage.setItem("currentAdminId", admin.id);
      localStorage.setItem("currentAdminName", admin.name);
      localStorage.setItem("currentAdminEmail", admin.email);
      localStorage.setItem("currentAdminDepartment", admin.unit);
      setSessionCookie("ff_admin_session", 60 * 60 * 24 * 7);
      toast.success(`Welcome back, ${admin.name}!`);
      router.push("/dashboard");
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedForgotEmail = forgotEmail.trim() || email.trim();
    if (!normalizedForgotEmail) {
      toast.error("Please enter your email before requesting OTP.");
      return;
    }

    setForgotEmail(normalizedForgotEmail);
    setIsForgotLoading(true);
    try {
      await forgotPassword({ email: normalizedForgotEmail });
      toast.success("If your email exists, an OTP was sent.");
      setIsResetCodeVerified(false);
      setResetOtp("");
      setNewPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleVerifyResetCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedForgotEmail = forgotEmail.trim();
    const normalizedOtp = resetOtp.trim();
    if (!normalizedForgotEmail || !normalizedOtp) {
      toast.error("Email and OTP are required.");
      return;
    }

    setIsVerifyResetCodeLoading(true);
    try {
      await verifyResetOTP({ email: normalizedForgotEmail, otp: normalizedOtp });
      setIsResetCodeVerified(true);
      toast.success("OTP verified. You can now set a new password.");
    } catch (err: unknown) {
      setIsResetCodeVerified(false);
      toast.error(err instanceof Error ? err.message : "Failed to verify OTP");
    } finally {
      setIsVerifyResetCodeLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedForgotEmail = forgotEmail.trim();
    const normalizedNewPassword = newPassword.trim();

    if (!normalizedForgotEmail || !normalizedNewPassword) {
      toast.error("Email and new password are required.");
      return;
    }

    if (!isResetCodeVerified) {
      toast.error("Please verify OTP first.");
      return;
    }
    setIsResetLoading(true);
    try {
      await resetPassword({ email: normalizedForgotEmail, newPassword: normalizedNewPassword });
      toast.success("Password reset successful. You can now log in.");
      setForgotOpen(false);
      setForgotEmail("");
      setResetOtp("");
      setNewPassword("");
      setIsResetCodeVerified(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-muted p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
            <LogIn className="h-8 w-8 text-accent" />
          </div>
          <CardTitle>Login to FeedForward</CardTitle>
          <CardDescription>
            Enter your credentials to continue
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Log In"}
            </Button>
            <div className="text-center">
              <Dialog
                open={forgotOpen}
                onOpenChange={(open) => {
                  setForgotOpen(open);
                  if (!open) {
                    setIsResetCodeVerified(false);
                    setIsForgotLoading(false);
                    setIsVerifyResetCodeLoading(false);
                    setIsResetLoading(false);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="text-sm text-accent hover:underline font-medium"
                    onClick={() => {
                      if (email.trim() && !forgotEmail.trim()) {
                        setForgotEmail(email.trim());
                      }
                    }}
                  >
                    Forgot Password?
                  </button>
                </DialogTrigger>
                <DialogContent
                  className="max-w-md"
                  onInteractOutside={() => {
                    setIsResetCodeVerified(false);
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Reset Password</DialogTitle>
                    <DialogDescription>
                      Request an OTP by email, verify it, then set your new password.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleForgotPassword} className="space-y-3">
                    <Label htmlFor="forgot-email">Email Address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="Enter your registered email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                    <Button type="submit" variant="outline" className="w-full" disabled={isForgotLoading}>
                      {isForgotLoading ? "Sending OTP..." : "Send OTP"}
                    </Button>
                  </form>

                  <form onSubmit={handleVerifyResetCode} className="space-y-3 pt-2">
                    <Label htmlFor="reset-otp">OTP</Label>
                    <Input
                      id="reset-otp"
                      placeholder="Paste OTP from email"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                      required
                    />
                    <Button type="submit" variant="outline" className="w-full" disabled={isVerifyResetCodeLoading}>
                      {isVerifyResetCodeLoading ? "Verifying OTP..." : "Verify OTP"}
                    </Button>
                  </form>

                  <form onSubmit={handleResetPassword} className="space-y-3 pt-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={!isResetCodeVerified}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-accent hover:bg-accent/90"
                      disabled={isResetLoading || !isResetCodeVerified}
                    >
                      {isResetLoading ? "Resetting..." : "Reset Password"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-accent hover:underline font-medium"
              >
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Hidden superadmin login — revealed only via Ctrl+Shift+S */}
      <Dialog open={showSuperAdmin} onOpenChange={setShowSuperAdmin}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-slate-900/10 flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-slate-900" />
            </div>
            <DialogTitle className="text-center">Restricted Access</DialogTitle>
            <DialogDescription className="text-center">
              Enter the system access key to continue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSuperAdminLogin} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="superadmin-key">Access Key</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="superadmin-key"
                  type="password"
                  placeholder="Enter access key"
                  className="pl-10"
                  value={superAdminKey}
                  onChange={(e) => setSuperAdminKey(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-700"
              size="lg"
              disabled={isSuperAdminLoading}
            >
              {isSuperAdminLoading ? "Verifying..." : "Access Console"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}