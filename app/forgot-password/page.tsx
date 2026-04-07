"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, ShieldCheck } from "lucide-react";
import { forgotPassword, verifyResetOTP } from "@/lib/api";
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
import { toastApiError } from "@/lib/errorHandling";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleRequestOTP = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("Please enter your email.");
      return;
    }
    setIsRequesting(true);
    try {
      await forgotPassword({ email: normalizedEmail });
      toast.success("If your email exists, an OTP was sent.");
      setStep("verify");
      setOtp("");
    } catch (error) {
      toastApiError(error, "Failed to send OTP");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleVerifyOTP = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("Please enter your email.");
      return;
    }
    if (otp.trim().length !== 6) {
      toast.error("Enter the 6-digit OTP sent to your email.");
      return;
    }

    setIsVerifying(true);
    try {
      const verification = await verifyResetOTP({
        email: normalizedEmail,
        otp: otp.trim(),
      });
      localStorage.setItem("passwordResetEmail", normalizedEmail);
      if (verification.role) {
        localStorage.setItem("passwordResetRole", verification.role);
      } else {
        localStorage.removeItem("passwordResetRole");
      }
      router.push("/reset-password");
    } catch (error) {
      toastApiError(error, "Failed to verify OTP");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white to-muted px-4 py-8 sm:py-12">
      <div className="container mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6">
        <Card className="w-full shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 sm:mb-4">
              <ShieldCheck className="h-8 w-8 text-accent" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl">Forgot Password</CardTitle>
            <CardDescription>
              Enter your email and verify the OTP to reset your password.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleRequestOTP} className="space-y-4">
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
              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                size="lg"
                disabled={isRequesting}
              >
                {isRequesting ? "Sending OTP..." : "Send OTP"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {step === "verify" ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 sm:px-4">
            <Card className="w-[92vw] max-w-md border border-muted/60 bg-white shadow-xl sm:w-full">
              <CardHeader className="text-center pb-3">
                <CardTitle className="text-lg sm:text-xl">Enter OTP</CardTitle>
                <CardDescription>
                  Code sent to {email.trim() || "your email"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <InputOTP
                    id="otp"
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
                    disabled={isVerifying}
                  >
                    {isVerifying ? "Verifying..." : "Verify"}
                  </Button>
                </form>
                <div className="text-center text-xs text-muted-foreground">
                  Didn&apos;t receive the code?
                </div>
                <button
                  type="button"
                  className="w-full text-sm text-accent hover:underline font-medium"
                  onClick={async () => {
                    const normalizedEmail = email.trim();
                    if (!normalizedEmail) {
                      toast.error("Please enter your email.");
                      return;
                    }
                    setIsRequesting(true);
                    try {
                      await forgotPassword({ email: normalizedEmail });
                      toast.success("If your email exists, an OTP was sent.");
                      setOtp("");
                    } catch (error) {
                      toastApiError(error, "Failed to send OTP");
                    } finally {
                      setIsRequesting(false);
                    }
                  }}
                  disabled={isRequesting}
                >
                  {isRequesting ? "Sending OTP..." : "Resend OTP"}
                </button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}