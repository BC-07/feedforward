"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogIn, Mail, Lock, User, Shield } from "lucide-react";
import { loginUser, loginAdmin } from "@/frontend/api";

export default function Login() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleUserLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await loginUser({ email: userEmail, password: userPassword });
      const user = res.data;
      localStorage.setItem("isUserLoggedIn", "true");
      localStorage.setItem("currentUserId", user.id);
      localStorage.setItem("currentUserName", user.name);
      localStorage.setItem("currentUserEmail", user.email);
      toast.success(`Welcome back, ${user.name}!`);
      router.push("/user");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await loginAdmin({ email: adminEmail, password: adminPassword });
      const admin = res.data;
      localStorage.setItem("isAdminLoggedIn", "true");
      localStorage.setItem("currentAdminId", admin.id);
      localStorage.setItem("currentAdminName", admin.name);
      localStorage.setItem("currentAdminEmail", admin.email);
      localStorage.setItem("currentAdminDepartment", admin.unit);
      toast.success(`Welcome back, ${admin.name}!`);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid email or password");
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
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Log In as User"}
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
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Log In as Admin"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Don&apos;t have an admin account?{" "}
                  <Link
                    href="/register"
                    className="text-black hover:underline font-medium"
                  >
                    Register here
                  </Link>
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

