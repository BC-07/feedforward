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
import { toast } from "sonner";
import { LogIn, Mail, Lock } from "lucide-react";
import {
  loginUser,
  loginAdmin,
  forgotPassword,
  verifyResetOTP,
} from "@/frontend/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [isOtpRequestLoading, setIsOtpRequestLoading] = useState(false);

  useEffect(() => {
    const isUserLoggedIn = localStorage.getItem("isUserLoggedIn") === "true";
    const currentUserId = localStorage.getItem("currentUserId");
    if (isUserLoggedIn && currentUserId) {
      router.replace("/user");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    if (!normalizedEmail || !normalizedPassword) {
      toast.error("Email and password are required.");
      return;
    }

    setIsLoading(true);

    if (isOtpMode) {
      try {
        const res = await verifyResetOTP({ email: normalizedEmail, otp: normalizedPassword });
        const user = res.data;
        localStorage.setItem("isUserLoggedIn", "true");
        localStorage.setItem("currentUserId", user.id);
        localStorage.setItem("currentUserName", user.name);
        localStorage.setItem("currentUserEmail", user.email);
        toast.success(`Welcome back, ${user.name}!`);
        setPassword("");
        setIsOtpMode(false);
        router.push("/user");
        return;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to verify OTP");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const userRes = await loginUser({ email: normalizedEmail, password: normalizedPassword });
      const user = userRes.data;
      localStorage.setItem("isUserLoggedIn", "true");
      localStorage.setItem("currentUserId", user.id);
      localStorage.setItem("currentUserName", user.name);
      localStorage.setItem("currentUserEmail", user.email);
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
      if (admin.isSuperAdmin) {
        localStorage.setItem("isSuperAdminLoggedIn", "true");
        localStorage.setItem("superAdminId", admin.id);
        localStorage.setItem("superAdminName", admin.name);
        toast.success(`Welcome back, ${admin.name}!`);
        router.push("/superadmin");
        return;
      }

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

  const handleForgotPasswordClick = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("Please enter your email before requesting OTP.");
      return;
    }

    setIsOtpRequestLoading(true);
    try {
      await forgotPassword({ email: normalizedEmail });
      toast.success("If your email exists, an OTP was sent.");
      setIsOtpMode(true);
      setPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsOtpRequestLoading(false);
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
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{isOtpMode ? "One-Time Password (OTP)" : "Password"}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={isOtpMode ? "Enter the OTP sent to your email" : "Enter your password"}
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isOtpMode ? "one-time-code" : "current-password"}
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
              {isLoading ? (isOtpMode ? "Verifying OTP..." : "Logging in...") : (isOtpMode ? "Verify OTP" : "Log In")}
            </Button>
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-accent hover:underline font-medium"
                onClick={handleForgotPasswordClick}
                disabled={isOtpRequestLoading || isLoading}
              >
                {isOtpRequestLoading ? "Sending OTP..." : isOtpMode ? "Resend OTP" : "Forgot Password?"}
              </button>
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
    </div>
  );
}