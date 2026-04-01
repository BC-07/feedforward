"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resetPassword } from "@/lib/api";
import PasswordFormCard from "@/components/auth/PasswordFormCard";

export default function ResetPasswordPage() {
  const router = useRouter();
  const resetEmail = useMemo(
    () =>
      typeof window !== "undefined"
        ? localStorage.getItem("passwordResetEmail")
        : "",
    [],
  );
  const resetRole = useMemo(
    () =>
      typeof window !== "undefined"
        ? localStorage.getItem("passwordResetRole")
        : "",
    [],
  );

  useEffect(() => {
    if (!resetEmail) {
      toast.error("Missing or expired reset session. Please request a new OTP.");
      router.replace("/login");
    }
  }, [resetEmail, router]);

  const handleSubmit = async (newPassword: string) => {
    if (!resetEmail) {
      toast.error("Missing or expired reset session. Please request a new OTP.");
      router.replace("/login");
      return;
    }
    try {
      await resetPassword({
        email: resetEmail,
        newPassword,
        role:
          resetRole === "admin" || resetRole === "user"
            ? resetRole
            : undefined,
      });
      localStorage.removeItem("passwordResetEmail");
      localStorage.removeItem("passwordResetRole");
      toast.success("Password updated. You can now log in.");
      router.push("/login");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reset password";
      toast.error(message);
    }
  };

  return (
    <PasswordFormCard
      title="Reset Your Password"
      description="Create a new password for your account."
      submitLabel="Reset Password"
      onSubmit={handleSubmit}
    />
  );
}
