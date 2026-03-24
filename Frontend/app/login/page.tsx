"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAdmin, loginUser } from "@/lib/api";
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
      localStorage.removeItem("isSuperAdminLoggedIn");
      localStorage.removeItem("superAdminName");
      localStorage.removeItem("superAdminExpiresAt");
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
      if (admin.isSuperAdmin) {
        const superName = admin.name || admin.email || "Superadmin";
        localStorage.setItem("isSuperAdminLoggedIn", "true");
        localStorage.setItem("superAdminName", superName);
        localStorage.removeItem("superAdminExpiresAt");
        localStorage.removeItem("isAdminLoggedIn");
        localStorage.removeItem("currentAdminId");
        localStorage.removeItem("currentAdminName");
        localStorage.removeItem("currentAdminEmail");
        localStorage.removeItem("currentAdminDepartment");
        localStorage.removeItem("isUserLoggedIn");
        localStorage.removeItem("currentUserId");
        localStorage.removeItem("currentUserName");
        localStorage.removeItem("currentUserEmail");
        toast.success(`Welcome back, ${superName}!`);
        router.push("/superadmin");
        return;
      }
      localStorage.setItem("isAdminLoggedIn", "true");
      localStorage.setItem("currentAdminId", admin.id);
      localStorage.setItem("currentAdminName", admin.name);
      localStorage.setItem("currentAdminEmail", admin.email);
      localStorage.setItem("currentAdminDepartment", admin.unit);
      localStorage.removeItem("isUserLoggedIn");
      localStorage.removeItem("currentUserId");
      localStorage.removeItem("currentUserName");
      localStorage.removeItem("currentUserEmail");
      localStorage.removeItem("isSuperAdminLoggedIn");
      localStorage.removeItem("superAdminName");
      localStorage.removeItem("superAdminExpiresAt");
      toast.success(`Welcome back, ${admin.name}!`);
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invalid email or password",
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center sm:items-center sm:justify-center bg-gradient-to-br from-white to-muted px-4 py-4 sm:py-12">
      <Card className="max-w-md w-full shadow-lg translate-y-[20%] sm:translate-y-0">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 sm:mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
            <LogIn className="h-8 w-8 text-accent" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Login to FeedForward</CardTitle>
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

        </CardContent>
      </Card>
    </div>
  );
}
