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
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogIn, Mail, Lock, KeyRound } from "lucide-react";
import { loginUser, loginAdmin, superAdminLogin } from "@/frontend/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [superAdminKey, setSuperAdminKey] = useState("");
  const [isSuperAdminLoading, setIsSuperAdminLoading] = useState(false);

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
    setIsLoading(true);
    try {
      // Try user login first
      const userRes = await loginUser({ email, password });
      const user = userRes.data;
      localStorage.setItem("isUserLoggedIn", "true");
      localStorage.setItem("currentUserId", user.id);
      localStorage.setItem("currentUserName", user.name);
      localStorage.setItem("currentUserEmail", user.email);
      toast.success(`Welcome back, ${user.name}!`);
      router.push("/user");
      return;
    } catch {
      // Not a user — try admin
    }
    try {
      const adminRes = await loginAdmin({ email, password });
      const admin = adminRes.data;
      localStorage.setItem("isAdminLoggedIn", "true");
      localStorage.setItem("currentAdminId", admin.id);
      localStorage.setItem("currentAdminName", admin.name);
      localStorage.setItem("currentAdminEmail", admin.email);
      localStorage.setItem("currentAdminDepartment", admin.unit);
      toast.success(`Welcome back, ${admin.name}!`);
      router.push("/dashboard");
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setIsLoading(false);
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