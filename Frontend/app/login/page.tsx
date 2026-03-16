"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAdmin, loginSuperAdmin, loginUser } from "@/lib/api";
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
import { toast } from "sonner";
import { LogIn, Mail, Lock } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [superAdminUsername, setSuperAdminUsername] = useState("");
  const [superAdminPassword, setSuperAdminPassword] = useState("");
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [secretTapCount, setSecretTapCount] = useState(0);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setShowSuperAdmin(true);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const user = await loginUser({
        email,
        password,
      });
      localStorage.setItem("isUserLoggedIn", "true");
      localStorage.setItem("currentUserId", user.id);
      localStorage.setItem("currentUserName", user.name);
      localStorage.setItem("currentUserEmail", user.email);
      localStorage.removeItem("isAdminLoggedIn");
      localStorage.removeItem("currentAdminId");
      localStorage.removeItem("currentAdminName");
      localStorage.removeItem("currentAdminEmail");
      localStorage.removeItem("currentAdminDepartment");
      toast.success(`Welcome back, ${user.name}!`);
      router.push("/user");
      return;
    } catch {
      // Try admin login with the same form credentials.
    }

    try {
      const admin = await loginAdmin({
        email,
        password,
      });
      localStorage.setItem("isAdminLoggedIn", "true");
      localStorage.setItem("currentAdminId", admin.id);
      localStorage.setItem("currentAdminName", admin.name);
      localStorage.setItem("currentAdminEmail", admin.email);
      localStorage.setItem("currentAdminDepartment", admin.unit);
      localStorage.removeItem("isUserLoggedIn");
      localStorage.removeItem("currentUserId");
      localStorage.removeItem("currentUserName");
      localStorage.removeItem("currentUserEmail");
      toast.success(`Welcome back, ${admin.name}!`);
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invalid email or password",
      );
    }
  };

  const handleSuperAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const session = await loginSuperAdmin({
        username: superAdminUsername,
        password: superAdminPassword,
      });
      localStorage.setItem("isSuperAdminLoggedIn", "true");
      localStorage.setItem("superAdminName", session.username);
      localStorage.setItem("superAdminExpiresAt", session.expiresAt);
      toast.success("Superadmin access granted");
      router.push("/superadmin");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invalid superadmin credentials",
      );
    }
  };

  const handleSecretTap = () => {
    const nextCount = secretTapCount + 1;
    setSecretTapCount(nextCount);
    if (nextCount >= 5) {
      setShowSuperAdmin(true);
      setSecretTapCount(0);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-muted p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <button
            type="button"
            onClick={handleSecretTap}
            className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center"
          >
            <LogIn className="h-8 w-8 text-accent" />
          </button>
          <CardTitle>Login to FeedForward</CardTitle>
          <CardDescription>Sign in with your account credentials</CardDescription>
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
            >
              Log In
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-accent hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </form>

          {showSuperAdmin && (
            <div className="mt-6 border-t pt-6">
              <div className="mb-4 text-center">
                <p className="text-sm font-semibold text-primary">
                  Restricted Console
                </p>
                <p className="text-xs text-muted-foreground">
                  Hidden access for system-level administration
                </p>
              </div>
              <form onSubmit={handleSuperAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="superadmin-username">Username</Label>
                  <Input
                    id="superadmin-username"
                    value={superAdminUsername}
                    onChange={(e) => setSuperAdminUsername(e.target.value)}
                    placeholder="Enter superadmin username"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="superadmin-password">Password</Label>
                  <Input
                    id="superadmin-password"
                    type="password"
                    value={superAdminPassword}
                    onChange={(e) => setSuperAdminPassword(e.target.value)}
                    placeholder="Enter superadmin password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" variant="secondary">
                  Open Superadmin Dashboard
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
