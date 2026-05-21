"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { setAdminPassword } from "@/lib/api";
import PasswordFormCard from "@/components/auth/PasswordFormCard";

export default function AdminSetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const handleSubmit = async (newPassword: string) => {
    if (!token) {
      toast.error("Missing or invalid set-password link.");
      return;
    }
    try {
      await setAdminPassword({ token, newPassword });
      toast.success("Password set successfully. You can now log in.");
      router.push("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set password";
      toast.error(message);
    }
  };

  return (
    <PasswordFormCard
      title="Set Your Password"
      description="Create a password to activate your admin account."
      submitLabel="Set Password"
      onSubmit={handleSubmit}
    />
  );
}
