"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Mail, Lock, User } from "lucide-react";
import { registerUser } from "@/frontend/api";

function TermsContent() {
  return (
    <div className="space-y-5 text-sm leading-6 text-foreground">
      <section>
        <h2 className="text-base font-semibold">1. Account Responsibility</h2>
        <p>
          You are responsible for maintaining the confidentiality of your login credentials and
          for activities performed using your account.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">2. Acceptable Use</h2>
        <p>
          You agree to use the platform only for lawful and legitimate feedback purposes. Misuse,
          abuse, or any attempt to disrupt the system is prohibited.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">3. Data and Privacy</h2>
        <p>
          Submitted feedback and account details may be stored and processed for service delivery,
          issue resolution, and system improvement.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">4. Administrative Control</h2>
        <p>
          The system administrators may manage account access, including disabling accounts when
          required for policy compliance or security reasons.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">5. Changes to Terms</h2>
        <p>
          These terms may be updated from time to time. Continued use of the platform after
          updates constitutes acceptance of the revised terms.
        </p>
      </section>
    </div>
  );
}

export default function Signup() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });

  useEffect(() => {
    const isUserLoggedIn = localStorage.getItem("isUserLoggedIn") === "true";
    const currentUserId = localStorage.getItem("currentUserId");
    if (isUserLoggedIn && currentUserId) {
      router.replace("/user");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!formData.termsAccepted) {
      toast.error("Please accept Terms & Conditions");
      return;
    }

    setIsLoading(true);
    try {
      await registerUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        termsAccepted: formData.termsAccepted,
      });
      toast.success("Account created successfully!");
      router.push("/login");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/login-bg.svg')" }}
    >
      <div className="absolute inset-0 bg-black/5" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute -left-6 -top-6 h-16 w-16 rounded-full bg-accent/90 shadow-lg" />
          <div className="pointer-events-none absolute -bottom-5 -right-5 h-10 w-10 rounded-full bg-accent/80 shadow-md" />

          <Card className="relative w-full border-0 bg-card shadow-2xl rounded-3xl">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="first-name"
                    placeholder="First name"
                    className="pl-10"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="last-name"
                    placeholder="Last name"
                    className="pl-10"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a password"
                    className="pl-10"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm password"
                    className="pl-10"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
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

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={formData.termsAccepted}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, termsAccepted: checked === true })
                }
              />
              <Label htmlFor="terms" className="text-xs text-muted-foreground leading-5">
                I agree to the{" "}
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-accent font-medium hover:underline"
                    >
                      Terms & Conditions
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogTitle>Terms & Conditions</DialogTitle>
                    <DialogDescription>
                      By creating and using a FeedForward account, you agree to the following terms.
                    </DialogDescription>
                    <div className="max-h-[60vh] overflow-y-auto pr-1">
                      <TermsContent />
                    </div>
                  </DialogContent>
                </Dialog>
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Create Account"}
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
        </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}