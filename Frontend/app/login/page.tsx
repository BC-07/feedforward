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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogIn, Mail, Lock, User, Shield } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
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

  const handleUserLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const user = await loginUser({
        email: userEmail,
        password: userPassword,
      });
      localStorage.setItem("isUserLoggedIn", "true");
      localStorage.setItem("currentUserId", user.id);
      localStorage.setItem("currentUserName", user.name);
      localStorage.setItem("currentUserEmail", user.email);
      toast.success(`Welcome back, ${user.name}!`);
      router.push("/user");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invalid email or password",
      );
    }
  };

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const admin = await loginAdmin({
        email: adminEmail,
        password: adminPassword,
      });
      localStorage.setItem("isAdminLoggedIn", "true");
      localStorage.setItem("currentAdminId", admin.id);
      localStorage.setItem("currentAdminName", admin.name);
      localStorage.setItem("currentAdminEmail", admin.email);
      localStorage.setItem("currentAdminDepartment", admin.unit);
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
      localStorage.setItem("superAdminToken", session.token);
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
          <CardDescription>
            Choose your account type to continue
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="user" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="user" className="gap-2">
                <User className="h-4 w-4" />
                User
              </TabsTrigger>
              <TabsTrigger value="admin" className="gap-2">
                <Shield className="h-4 w-4" />
                Admin
              </TabsTrigger>
            </TabsList>

            {/* USER LOGIN */}
            <TabsContent value="user">
              <form onSubmit={handleUserLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="user-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="user-password"
                      type="password"
                      placeholder="Enter your password"
                      className="pl-10"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent/90"
                  size="lg"
                >
                  Log In as User
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
            </TabsContent>

            {/* ADMIN LOGIN */}
            <TabsContent value="admin">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="Enter your password"
                      className="pl-10"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-black hover:bg-gray-800"
                  size="lg"
                >
                  Log In as Admin
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Admin accounts are managed by superadmin.
                </p>
              </form>
            </TabsContent>
          </Tabs>

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
