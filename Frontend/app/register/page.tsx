"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, Mail, User, UserPlus } from "lucide-react";
import { FieldError, FieldHint, RequiredMark } from "@/components/ux/form-feedback";

type RegisterErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function Signup() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const nextErrors: RegisterErrors = {};
    if (!formData.firstName.trim()) nextErrors.firstName = "First name is required.";
    if (!formData.lastName.trim()) nextErrors.lastName = "Last name is required.";
    if (!formData.email.trim()) nextErrors.email = "Email is required.";
    if (!formData.password.trim()) nextErrors.password = "Password is required.";
    if (formData.password && formData.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }
    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await registerUser({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });
      toast.success("Account created successfully.");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ff-page-shell flex min-h-screen items-center justify-center p-4">
      <Card className="ff-surface w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <UserPlus className="h-8 w-8 text-accent" />
          </div>
          <CardTitle>Create Account</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Fill out the details below to get started.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first-name">
                  First Name <RequiredMark />
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="first-name"
                    placeholder="Enter your first name"
                    className="pl-10"
                    value={formData.firstName}
                    onChange={(event) => {
                      setFormData((current) => ({ ...current, firstName: event.target.value }));
                      setErrors((current) => ({ ...current, firstName: undefined }));
                    }}
                    aria-invalid={Boolean(errors.firstName)}
                  />
                </div>
                <FieldError message={errors.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">
                  Last Name <RequiredMark />
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="last-name"
                    placeholder="Enter your last name"
                    className="pl-10"
                    value={formData.lastName}
                    onChange={(event) => {
                      setFormData((current) => ({ ...current, lastName: event.target.value }));
                      setErrors((current) => ({ ...current, lastName: undefined }));
                    }}
                    aria-invalid={Boolean(errors.lastName)}
                  />
                </div>
                <FieldError message={errors.lastName} />
              </div>
            </div>

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
                  value={formData.email}
                  onChange={(event) => {
                    setFormData((current) => ({ ...current, email: event.target.value }));
                    setErrors((current) => ({ ...current, email: undefined }));
                  }}
                  aria-invalid={Boolean(errors.email)}
                />
              </div>
              <FieldError message={errors.email} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <RequiredMark />
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a password"
                    className="pl-10"
                    value={formData.password}
                    onChange={(event) => {
                      setFormData((current) => ({ ...current, password: event.target.value }));
                      setErrors((current) => ({ ...current, password: undefined }));
                    }}
                    aria-invalid={Boolean(errors.password)}
                  />
                </div>
                <FieldError message={errors.password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  Confirm Password <RequiredMark />
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    className="pl-10"
                    value={formData.confirmPassword}
                    onChange={(event) => {
                      setFormData((current) => ({ ...current, confirmPassword: event.target.value }));
                      setErrors((current) => ({ ...current, confirmPassword: undefined }));
                    }}
                    aria-invalid={Boolean(errors.confirmPassword)}
                  />
                </div>
                <FieldError message={errors.confirmPassword} />
              </div>
            </div>

            <FieldHint message="Password must be at least 6 characters." />

            <Button type="submit" className="w-full bg-accent hover:bg-accent/90" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-accent hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
