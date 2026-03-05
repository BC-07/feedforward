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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogIn, Mail, Lock, User, Shield } from "lucide-react";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  school: string;
  department: string;
}

export default function Login() {
  const router = useRouter();

  const [userFormData, setUserFormData] = useState({ email: "", password: "" });
  const [adminFormData, setAdminFormData] = useState({ email: "", password: "" });

  const handleUserLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (typeof window === "undefined") return;

    const users: UserRecord[] = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find(
      (u) => u.email === userFormData.email && u.password === userFormData.password
    );

    if (user) {
      localStorage.setItem("isUserLoggedIn", "true");
      localStorage.setItem("currentUserId", user.id);
      localStorage.setItem("currentUserName", user.name);
      localStorage.setItem("currentUserEmail", user.email);
      localStorage.setItem("currentUserSchool", user.school);
      localStorage.setItem("currentUserDepartment", user.department);

      toast.success(`Welcome back, ${user.name}!`);
      router.push("/user");
    } else {
      toast.error("Invalid email or password");
    }
  };

  const handleAdminLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (typeof window === "undefined") return;

    const admins: UserRecord[] = JSON.parse(localStorage.getItem("admins") || "[]");
    const admin = admins.find(
      (a) => a.email === adminFormData.email && a.password === adminFormData.password
    );

    if (admin) {
      localStorage.setItem("isAdminLoggedIn", "true");
      localStorage.setItem("currentAdminId", admin.id);
      localStorage.setItem("currentAdminName", admin.name);
      localStorage.setItem("currentAdminEmail", admin.email);
      localStorage.setItem("currentAdminSchool", admin.school);
      localStorage.setItem("currentAdminDepartment", admin.department);

      toast.success(`Welcome back, ${admin.name}!`);
      router.push("/dashboard");
    } else {
      toast.error("Invalid email or password");
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
          <CardDescription>Choose your account type to continue</CardDescription>
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
                      value={userFormData.email}
                      onChange={(e) =>
                        setUserFormData({ ...userFormData, email: e.target.value })
                      }
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
                      value={userFormData.password}
                      onChange={(e) =>
                        setUserFormData({ ...userFormData, password: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  Log In as User
                </Button>

                <div className="text-center text-sm">
                  <p className="text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="text-accent hover:underline font-medium">
                      Sign up
                    </Link>
                  </p>
                </div>
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
                      value={adminFormData.email}
                      onChange={(e) =>
                        setAdminFormData({ ...adminFormData, email: e.target.value })
                      }
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
                      value={adminFormData.password}
                      onChange={(e) =>
                        setAdminFormData({ ...adminFormData, password: e.target.value })
                      }
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

                <div className="text-center text-sm">
                  <p className="text-muted-foreground">
                    Don&apos;t have an admin account?{" "}
                    <Link href="/register" className="text-black hover:underline font-medium">
                      Register here
                    </Link>
                  </p>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}