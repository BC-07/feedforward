"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { UserPlus, Mail, Lock, User, Shield, KeyRound } from "lucide-react";

const UNITS = [
  "IT Unit",
  "Finance & Registrar Office",
  "Student Affair Office",
  "Guidance Office",
  "Faculty Office",
];

export default function Signup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountType = searchParams.get("type") || "user";
  const [activeTab, setActiveTab] = useState(accountType);

  useEffect(() => {
    setActiveTab(accountType);
  }, [accountType]);

  const [userFormData, setUserFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [adminFormData, setAdminFormData] = useState({
    adminKey: "",
    firstName: "",
    lastName: "",
    email: "",
    unit: "",
    password: "",
    confirmPassword: "",
  });

  const handleUserSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (typeof window === "undefined") return;

    if (userFormData.password !== userFormData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (userFormData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    const users = JSON.parse(localStorage.getItem("users") || "[]");
    if (users.some((u: any) => u.email === userFormData.email)) {
      toast.error("Email already registered");
      return;
    }

    const newUser = {
      id: `USER-${Date.now()}`,
      name: `${userFormData.firstName} ${userFormData.lastName}`,
      firstName: userFormData.firstName,
      lastName: userFormData.lastName,
      email: userFormData.email,
      password: userFormData.password,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));
    toast.success("Account created successfully!");
    router.push("/login");
  };

  const handleAdminSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (typeof window === "undefined") return;

    if (adminFormData.adminKey !== "FEEDFORWARD2026") {
      toast.error("Invalid admin registration key");
      return;
    }
    if (adminFormData.password !== adminFormData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (adminFormData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!adminFormData.unit) {
      toast.error("Please select your unit");
      return;
    }

    const admins = JSON.parse(localStorage.getItem("admins") || "[]");
    if (admins.some((a: any) => a.email === adminFormData.email)) {
      toast.error("Email already registered");
      return;
    }

    // Explicitly construct — no spread to avoid stale/extra fields
    const newAdmin = {
      id: `ADMIN-${Date.now()}`,
      name: `${adminFormData.firstName} ${adminFormData.lastName}`,
      firstName: adminFormData.firstName,
      lastName: adminFormData.lastName,
      email: adminFormData.email,
      password: adminFormData.password,
      unit: adminFormData.unit, // e.g. "IT Unit"
      department: adminFormData.unit, // same value, for login compatibility
      createdAt: new Date().toISOString(),
    };
    admins.push(newAdmin);
    localStorage.setItem("admins", JSON.stringify(admins));
    toast.success("Admin account created successfully!");
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-muted p-4">
      <Card className="max-w-2xl w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-accent" />
          </div>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Join FeedForward to submit and track feedback
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="user">
                <User className="h-4 w-4 mr-2" />
                User Account
              </TabsTrigger>
              <TabsTrigger value="admin">
                <Shield className="h-4 w-4 mr-2" />
                Admin Account
              </TabsTrigger>
            </TabsList>

            {/* USER FORM */}
            <TabsContent value="user">
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-first-name">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="user-first-name"
                        placeholder="Enter your first name"
                        className="pl-10"
                        value={userFormData.firstName}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            firstName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-last-name">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="user-last-name"
                        placeholder="Enter your last name"
                        className="pl-10"
                        value={userFormData.lastName}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            lastName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-email">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="user-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={userFormData.email}
                      onChange={(e) =>
                        setUserFormData({
                          ...userFormData,
                          email: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-password">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="user-password"
                        type="password"
                        placeholder="Create a password"
                        className="pl-10"
                        value={userFormData.password}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            password: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-confirm-password">
                      Confirm Password{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="user-confirm-password"
                        type="password"
                        placeholder="Confirm your password"
                        className="pl-10"
                        value={userFormData.confirmPassword}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters
                </p>

                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent/90"
                  size="lg"
                >
                  Create User Account
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="text-accent font-medium hover:underline"
                  >
                    Log in
                  </Link>
                </p>
              </form>
            </TabsContent>

            {/* ADMIN FORM */}
            <TabsContent value="admin">
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-key">
                    Admin Registration Key{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-key"
                      type="password"
                      placeholder="Enter admin registration key"
                      className="pl-10"
                      value={adminFormData.adminKey}
                      onChange={(e) =>
                        setAdminFormData({
                          ...adminFormData,
                          adminKey: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contact your administrator for the registration key
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-first-name">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-first-name"
                        placeholder="Enter your first name"
                        className="pl-10"
                        value={adminFormData.firstName}
                        onChange={(e) =>
                          setAdminFormData({
                            ...adminFormData,
                            firstName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-last-name">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-last-name"
                        placeholder="Enter your last name"
                        className="pl-10"
                        value={adminFormData.lastName}
                        onChange={(e) =>
                          setAdminFormData({
                            ...adminFormData,
                            lastName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-email">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={adminFormData.email}
                      onChange={(e) =>
                        setAdminFormData({
                          ...adminFormData,
                          email: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-unit">
                    Unit <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={adminFormData.unit}
                    onValueChange={(value) =>
                      setAdminFormData({ ...adminFormData, unit: value })
                    }
                    required
                  >
                    <SelectTrigger id="admin-unit">
                      <SelectValue placeholder="Select your unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-password"
                        type="password"
                        placeholder="Create a password"
                        className="pl-10"
                        value={adminFormData.password}
                        onChange={(e) =>
                          setAdminFormData({
                            ...adminFormData,
                            password: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-confirm-password">
                      Confirm Password{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-confirm-password"
                        type="password"
                        placeholder="Confirm your password"
                        className="pl-10"
                        value={adminFormData.confirmPassword}
                        onChange={(e) =>
                          setAdminFormData({
                            ...adminFormData,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters
                </p>

                <Button
                  type="submit"
                  className="w-full bg-black hover:bg-gray-800"
                  size="lg"
                >
                  Create Admin Account
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="font-medium hover:underline">
                    Log in
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
