"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  loginAdmin,
  loginUser,
  requestUserLoginOTP,
  verifyUserLoginOTP,
} from "@/lib/api";
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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import { LogIn, Mail, Lock, Eye, EyeOff, Check } from "lucide-react";
import { toastApiError } from "@/lib/errorHandling";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRequestingOTP, setIsRequestingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [otpStep, setOtpStep] = useState<"none" | "verify">("none");
  const [expiredMessage, setExpiredMessage] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const clearAllAuthStorage = () => {
    const keys = [
      "isUserLoggedIn",
      "currentUserId",
      "currentUserName",
      "currentUserEmail",
      "isAdminLoggedIn",
      "currentAdminId",
      "currentAdminName",
      "currentAdminEmail",
      "currentAdminDepartment",
      "isSuperAdminLoggedIn",
      "superAdminName",
      "superAdminExpiresAt",
    ];
    keys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  };

  const setRememberedStorage = (enabled: boolean) => {
    localStorage.setItem("ffRememberMe", enabled ? "true" : "false");
  };

  const activeStorage = () => (rememberMe ? localStorage : sessionStorage);

  useEffect(() => {
    const storedMessage = localStorage.getItem("sessionExpiredMessage") || "";
    if (storedMessage) {
      localStorage.removeItem("sessionExpiredMessage");
      setExpiredMessage(storedMessage);
    }
  }, []);

  useEffect(() => {
    if (expiredMessage) {
      toast.error(expiredMessage);
    }
  }, [expiredMessage]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoggingIn || isRequestingOTP) return;
    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    if (!normalizedEmail) {
      toast.error("Email is required.");
      return;
    }

    if (normalizedPassword) {
      setIsLoggingIn(true);
      try {
        const admin = await loginAdmin({
          email: normalizedEmail,
          password: normalizedPassword,
          rememberMe,
        });
        if (admin.isSuperAdmin) {
          const superName = admin.name || admin.email || "Superadmin";
          clearAllAuthStorage();
          setRememberedStorage(rememberMe);
          const storage = activeStorage();
          storage.setItem("isSuperAdminLoggedIn", "true");
          storage.setItem("superAdminName", superName);
          toast.success(`Welcome back, ${superName}!`);
          router.push("/superadmin");
          return;
        }
        clearAllAuthStorage();
        setRememberedStorage(rememberMe);
        const storage = activeStorage();
        storage.setItem("isAdminLoggedIn", "true");
        storage.setItem("currentAdminId", admin.id);
        storage.setItem("currentAdminName", admin.name);
        storage.setItem("currentAdminEmail", admin.email);
        storage.setItem("currentAdminDepartment", admin.unit);
        toast.success(`Welcome back, ${admin.name}!`);
        router.push("/dashboard");
        return;
      } catch {
        try {
          const user = await loginUser({
            email: normalizedEmail,
            password: normalizedPassword,
            rememberMe,
          });
          clearAllAuthStorage();
          setRememberedStorage(rememberMe);
          const storage = activeStorage();
          storage.setItem("isUserLoggedIn", "true");
          storage.setItem("currentUserId", user.id);
          storage.setItem("currentUserName", user.name);
          storage.setItem("currentUserEmail", user.email);
          toast.success(`Welcome back, ${user.name}!`);
          router.push("/user/home");
          return;
        } catch (error) {
          toastApiError(error, "Invalid email or password");
          return;
        } finally {
          setIsLoggingIn(false);
        }
      }
    }

    try {
      setIsRequestingOTP(true);
      await requestUserLoginOTP({ email: normalizedEmail, rememberMe });
      setOtpEmail(normalizedEmail);
      setOtp("");
      setOtpStep("verify");
      toast.success("OTP sent. Enter the 6-digit code from your email.");
    } catch (error) {
      toastApiError(error, "Invalid email or password");
    } finally {
      setIsRequestingOTP(false);
    }
  };

  const handleVerifyOTP = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isVerifyingOTP) return;
    const normalizedEmail = otpEmail.trim();
    const normalizedOtp = otp.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    if (!normalizedEmail) {
      toast.error("Email is required.");
      return;
    }

    if (normalizedOtp.length !== 6) {
      toast.error("Enter the 6-digit OTP sent to your email.");
      return;
    }

    setIsVerifyingOTP(true);
    try {
      const user = await verifyUserLoginOTP({
        email: normalizedEmail,
        otp: normalizedOtp,
      });
      clearAllAuthStorage();
      setRememberedStorage(rememberMe);
      const storage = activeStorage();
      storage.setItem("isUserLoggedIn", "true");
      storage.setItem("currentUserId", user.id);
      storage.setItem("currentUserName", user.name);
      storage.setItem("currentUserEmail", user.email);
      toast.success(`Welcome back, ${user.name}!`);
      setOtpStep("none");
      router.push("/user/home");
    } catch (error) {
      toastApiError(error, "Failed to verify OTP");
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white via-orange-50 to-white px-4 py-8 sm:py-12">
      <div className="container mx-auto flex min-h-full max-w-md items-center justify-center">
        <Card className="w-full shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 sm:mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
              <LogIn className="h-8 w-8 text-accent" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl">Login to FeedForward</CardTitle>
            <CardDescription>Sign in with your account credentials</CardDescription>
          </CardHeader>

          <CardContent>
            {expiredMessage ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {expiredMessage}
              </div>
            ) : null}
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
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                size="lg"
                disabled={isLoggingIn || isRequestingOTP}
              >
                {isLoggingIn ? "Logging in..." : isRequestingOTP ? "Sending OTP..." : "Log In"}
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe((prev) => !prev)}
                  className={`flex h-4 w-4 items-center justify-center rounded-[4px] border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                    rememberMe
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-orange-300 bg-white text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" />
                </button>
                Remember Me
              </label>
              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-accent hover:underline font-medium"
                >
                  Forgot Password?
                </Link>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="font-medium text-accent hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
      {otpStep === "verify" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 sm:px-4">
          <Card className="w-[92vw] max-w-md border border-muted/60 bg-white shadow-xl sm:w-full">
            <CardHeader className="text-center pb-3">
              <CardTitle className="text-lg sm:text-xl">Enter OTP</CardTitle>
              <CardDescription>
                Code sent to {otpEmail.trim() || "your email"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <InputOTP
                  id="login-otp"
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="h-10 w-10 rounded-md text-sm sm:h-14 sm:w-14 sm:text-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent/90"
                  size="lg"
                  disabled={isVerifyingOTP}
                >
                  {isVerifyingOTP ? "Verifying..." : "Verify"}
                </Button>
              </form>
              <button
                type="button"
                className="w-full text-sm text-accent hover:underline font-medium"
                onClick={() => setOtpStep("none")}
                disabled={isVerifyingOTP}
              >
                Cancel
              </button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
