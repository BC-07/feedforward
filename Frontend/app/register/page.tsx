"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { toastApiError } from "@/lib/errorHandling";
import { UserPlus, Mail, Lock, User, Eye, EyeOff } from "lucide-react";

export default function Signup() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!hasAcceptedTerms) {
      toast.error("You must accept the Terms and Conditions");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      await registerUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
      });
      toast.success("Account created successfully!");
      router.push("/login");
    } catch (error) {
      toastApiError(error, "Failed to create account.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-orange-50 to-white p-4 sm:p-6">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="first-name"
                    placeholder="Enter your first name"
                    className="pl-10"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firstName: e.target.value,
                      })
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
                    placeholder="Enter your last name"
                    className="pl-10"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lastName: e.target.value,
                      })
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
                    setFormData({
                      ...formData,
                      email: e.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    className="pl-10 pr-10"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        password: e.target.value,
                      })
                    }
                    required
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
                {formData.password.length > 0 && formData.password.length < 6 ? (
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 6 characters
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm your password"
                    className="pl-10 pr-10"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <Checkbox
                id="accept-terms"
                checked={hasAcceptedTerms}
                onCheckedChange={(value) => setHasAcceptedTerms(Boolean(value))}
                className="mt-1"
              />
              <div className="space-y-1 text-sm">
                <Label htmlFor="accept-terms" className="font-normal">
                  I agree to the{" "}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="text-accent font-medium hover:underline"
                      >
                        Terms and Conditions
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>FeedForward Terms and Conditions</DialogTitle>
                        <DialogDescription>
                          Please read these terms carefully before creating your account.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                        <section className="space-y-2">
                          <h4 className="text-foreground font-semibold">1. Account Use</h4>
                          <p>
                            You agree to provide accurate information and to keep your account
                            credentials secure. You are responsible for all activity that occurs
                            under your account.
                          </p>
                        </section>
                        <section className="space-y-2">
                          <h4 className="text-foreground font-semibold">2. Acceptable Use</h4>
                          <p>
                            You will use FeedForward only for lawful purposes and will not submit
                            content that is harmful, abusive, or violates the rights of others.
                          </p>
                        </section>
                        <section className="space-y-2">
                          <h4 className="text-foreground font-semibold">3. Feedback Content</h4>
                          <p>
                            By submitting feedback, you grant the organization permission to review,
                            store, and act on your submissions for service improvement and support.
                          </p>
                        </section>
                        <section className="space-y-2">
                          <h4 className="text-foreground font-semibold">4. Privacy</h4>
                          <p>
                            We collect and process your data to provide the service. Personal
                            information is handled according to our internal privacy and data
                            protection practices.
                          </p>
                        </section>
                        <section className="space-y-2">
                          <h4 className="text-foreground font-semibold">5. Changes to Terms</h4>
                          <p>
                            We may update these terms from time to time. Continued use of the service
                            after changes means you accept the updated terms.
                          </p>
                        </section>
                      </div>
                    </DialogContent>
                  </Dialog>
                  .
                </Label>
                <p className="text-xs text-muted-foreground">
                  You must accept the terms to create an account.
                </p>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90"
              size="lg"
              disabled={!hasAcceptedTerms}
            >
              Create Account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-accent font-medium hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
