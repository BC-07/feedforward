"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Mail, ShieldCheck, X } from "lucide-react";
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
  const [hasRequestedOtp, setHasRequestedOtp] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");

  useEffect(() => {
    if (!emailError) return;
    const timeoutId = window.setTimeout(() => {
      setEmailError("");
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [emailError]);

  const closeOtpModal = () => {
    setStep("request");
    setOtp("");
    setHasRequestedOtp(false);
    setOtpError("");
  };

  const handleRequestOTP = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setEmailError("Please enter your email.");
      toast.error("Please enter your email.");
      return;
    }
    setEmailError("");
    setIsRequesting(true);
    try {
      const response = await forgotPassword({ email: normalizedEmail });
      if (response.sent) {
        setStep("verify");
        setHasRequestedOtp(true);
        setEmailError("");
        setOtpError("");
        toast.success("OTP sent. Check your email for the 6-digit code.");
        setOtp("");
      }
    } catch (error) {
      setStep("request");
      setHasRequestedOtp(false);
      setOtp("");
      setOtpError("");
      setEmailError("Email is invalid or not registered.");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleVerifyOTP = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    const normalizedOtp = otp.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!normalizedEmail) {
      toast.error("Please enter your email.");
      return;
    }
    if (normalizedOtp.length !== 6) {
      setOtpError("Enter the 6-digit OTP.");
      toast.error("Enter the 6-digit OTP sent to your email.");
      return;
    }

    setIsVerifying(true);
    setOtpError("");
    try {
      const verification = await verifyResetOTP({
        email: normalizedEmail,
        otp: normalizedOtp,
      });
      localStorage.setItem("passwordResetEmail", normalizedEmail);
      if (verification.role) {
        localStorage.setItem("passwordResetRole", verification.role);
      } else {
        localStorage.removeItem("passwordResetRole");
      }
      router.push("/reset-password");
    } catch (error) {
      setOtpError("Incorrect or expired OTP. Please try again.");
      toastApiError(error, "Failed to verify OTP");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white via-orange-50 to-white px-4 py-8 sm:py-12">
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
                    className={`pl-10 ${emailError ? "border-destructive ring-1 ring-destructive" : ""}`}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    required
                  />
                  {emailError ? (
                    <div className="pointer-events-none absolute right-0 top-0 z-20 -translate-y-[115%]">
                      <div className="relative flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-sm text-amber-900 shadow-sm backdrop-blur-sm">
                        <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-amber-400/80 text-amber-950">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </div>
                        <span>{emailError}</span>
                        <span className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 border-b border-r border-amber-300/50 bg-amber-50/70" />
                      </div>
                    </div>
                  ) : null}
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 sm:px-4"
            onClick={closeOtpModal}
          >
            <Card
              className="relative w-[92vw] max-w-md border border-muted/60 bg-white shadow-xl sm:w-full"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close OTP modal"
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={closeOtpModal}
                disabled={isVerifying || isRequesting}
              >
                <X className="h-4 w-4" />
              </button>
              <CardHeader className="text-center pb-3">
                <CardTitle className="text-lg sm:text-xl">Enter OTP</CardTitle>
                <CardDescription>
                  Code sent to {email.trim() || "your email"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="relative">
                    {otpError ? (
                      <div className="pointer-events-none absolute bottom-full left-0 right-0 z-20 mb-2">
                        <div className="relative flex w-full items-center gap-2 rounded-md border border-rose-300/50 bg-rose-50/70 px-3 py-2 text-sm text-rose-900 shadow-sm backdrop-blur-sm">
                          <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-rose-400/80 text-rose-950">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </div>
                          <span className="min-w-0 break-words leading-5">{otpError}</span>
                          <span className="absolute -bottom-1 right-6 h-2 w-2 rotate-45 border-b border-r border-rose-300/50 bg-rose-50/70" />
                        </div>
                      </div>
                    ) : null}
                    <InputOTP
                      id="otp"
                      maxLength={6}
                      value={otp}
                      onChange={(value) => {
                        setOtp(value);
                        if (otpError) setOtpError("");
                      }}
                      containerClassName="justify-center"
                    >
                      <InputOTPGroup className="gap-2 sm:gap-3">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className={`h-10 w-10 rounded-md text-sm sm:h-14 sm:w-14 sm:text-lg ${
                              otpError ? "border-destructive ring-1 ring-destructive" : ""
                            }`}
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-accent hover:bg-accent/90"
                    size="lg"
                    disabled={isVerifying || !hasRequestedOtp}
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
                      const response = await forgotPassword({ email: normalizedEmail });
                      if (response.sent) {
                        toast.success("OTP sent. Check your email for the 6-digit code.");
                        setOtpError("");
                        setOtp("");
                      }
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
