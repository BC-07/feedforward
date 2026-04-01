"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
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

type PasswordFormCardProps = {
  title: string;
  description: string;
  submitLabel: string;
  onSubmit: (newPassword: string) => Promise<void>;
};

export default function PasswordFormCard({
  title,
  description,
  submitLabel,
  onSubmit,
}: PasswordFormCardProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.trim().length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(password.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted px-4 py-8 sm:py-12">
      <div className="container mx-auto flex min-h-full max-w-md items-center justify-center">
        <Card className="w-full shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 sm:mb-4">
              <Lock className="h-8 w-8 text-accent" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter a new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : submitLabel}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
