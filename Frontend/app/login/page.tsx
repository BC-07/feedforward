"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAdmin, loginSuperAdmin, loginUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, LogIn, Lock, Mail } from "lucide-react";
import { FieldError, RequiredMark } from "@/components/ux/form-feedback";

type LoginErrors = {
  email?: string;
  password?: string;
};

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [superAdminUsername, setSuperAdminUsername] = useState("");
  const [superAdminPassword, setSuperAdminPassword] = useState("");
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuperSubmitting, setIsSuperSubmitting] = useState(false);

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

  const validateLogin = () => {
    const nextErrors: LoginErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    if (!password.trim()) nextErrors.password = "Password is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateLogin()) return;

    setIsSubmitting(true);
    try {
      const user = await loginUser({ email: email.trim(), password });
      localStorage.setItem("isUserLoggedIn", "true");
      localStorage.setItem("currentUserId", user.id);
      localStorage.setItem("currentUserName", user.name);
      localStorage.setItem("currentUserEmail", user.email);
      localStorage.removeItem("isAdminLoggedIn");
      localStorage.removeItem("currentAdminId");
      localStorage.removeItem("currentAdminName");
      localStorage.removeItem("currentAdminEmail");
      localStorage.removeItem("currentAdminDepartment");
      window.dispatchEvent(new Event("ff-auth"));
      toast.success(`Welcome back, ${user.name}!`);
      router.push("/user");
      return;
    } catch {
      // Fallback: shared login form also accepts admin credentials.
    }

    try {
      const admin = await loginAdmin({ email: email.trim(), password });
      localStorage.setItem("isAdminLoggedIn", "true");
      localStorage.setItem("currentAdminId", admin.id);
      localStorage.setItem("currentAdminName", admin.name);
      localStorage.setItem("currentAdminEmail", admin.email);
      localStorage.setItem("currentAdminDepartment", admin.unit);
      localStorage.removeItem("isUserLoggedIn");
      localStorage.removeItem("currentUserId");
      localStorage.removeItem("currentUserName");
      localStorage.removeItem("currentUserEmail");
      window.dispatchEvent(new Event("ff-auth"));
      toast.success(`Welcome back, ${admin.name}!`);
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuperAdminLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!superAdminUsername.trim() || !superAdminPassword.trim()) {
      toast.error("Superadmin username and password are required.");
      return;
    }

    setIsSuperSubmitting(true);
    try {
      const session = await loginSuperAdmin({
        username: superAdminUsername.trim(),
        password: superAdminPassword,
      });
      localStorage.setItem("isSuperAdminLoggedIn", "true");
      localStorage.setItem("superAdminToken", session.token);
      localStorage.setItem("superAdminName", session.username);
      localStorage.setItem("superAdminExpiresAt", session.expiresAt);
      window.dispatchEvent(new Event("ff-auth"));
      toast.success("Superadmin access granted.");
      router.push("/superadmin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid superadmin credentials.");
    } finally {
      setIsSuperSubmitting(false);
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
    <div className="ff-page-shell flex min-h-screen items-center justify-center p-4">
      <Card className="ff-surface w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <button
            type="button"
            onClick={handleSecretTap}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10"
            aria-label="Hidden superadmin access trigger"
          >
            <LogIn className="h-8 w-8 text-accent" />
          </button>
          <CardTitle>Login to FeedForward</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Enter your email and password to continue.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <RequiredMark />
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((current) => ({ ...current, email: undefined }));
                  }}
                  aria-invalid={Boolean(errors.email)}
                />
              </div>
              <FieldError message={errors.email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                Password <RequiredMark />
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  className="pl-10"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  aria-invalid={Boolean(errors.password)}
                />
              </div>
              <FieldError message={errors.password} />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log In
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-medium text-accent hover:underline">
                Sign up
              </Link>
            </p>
          </form>

          {showSuperAdmin && (
            <div className="mt-6 border-t pt-6">
              <div className="mb-4 text-center">
                <p className="text-sm font-semibold text-primary">Restricted Console</p>
                <p className="text-xs text-muted-foreground">
                  Hidden access for system-level administration
                </p>
              </div>
              <form onSubmit={handleSuperAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="superadmin-username">
                    Username <RequiredMark />
                  </Label>
                  <Input
                    id="superadmin-username"
                    value={superAdminUsername}
                    onChange={(event) => setSuperAdminUsername(event.target.value)}
                    placeholder="Enter superadmin username"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="superadmin-password">
                    Password <RequiredMark />
                  </Label>
                  <Input
                    id="superadmin-password"
                    type="password"
                    value={superAdminPassword}
                    onChange={(event) => setSuperAdminPassword(event.target.value)}
                    placeholder="Enter superadmin password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" variant="secondary" disabled={isSuperSubmitting}>
                  {isSuperSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
