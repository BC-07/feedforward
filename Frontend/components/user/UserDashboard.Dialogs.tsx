"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Copy, X } from "lucide-react";
import { FeedbackSuccessCard } from "@/components/feedback/FeedbackSuccessCard";
import type { Feedback } from "@/lib/api";

// Props for TrackingIdSuccess component
interface TrackingIdSuccessProps {
  trackingId: string | null;
  currentUserEmail: string | undefined;
  onClose: () => void;
  onCopyTrackingId: (text: string) => void;
}

export function TrackingIdSuccess({
  trackingId,
  currentUserEmail,
  onClose,
  onCopyTrackingId,
}: TrackingIdSuccessProps) {
  if (!trackingId) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4 py-8 animate-in fade-in-0"
      onClick={onClose}
    >
      <div className="w-full max-w-lg -translate-y-[10%]">
        <Card
          className="ff-user-dashboard-theme relative animate-in zoom-in-95 fade-in-0 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-all outline-none hover:bg-muted hover:text-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
              <ArrowRight className="h-8 w-8 text-accent" />
            </div>
            <CardTitle>Feedback Submitted!</CardTitle>
            <CardDescription className="text-black">
              Your feedback has been received successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full bg-muted rounded-lg p-4 text-center relative">
              <p className="mb-2 text-sm text-black">
                Your Tracking ID
              </p>
              <p className="text-2xl font-bold text-primary">
                {trackingId}
              </p>
              <button
                type="button"
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-white/80 text-muted-foreground hover:bg-white hover:text-foreground"
                onClick={() => onCopyTrackingId(trackingId)}
                aria-label="Copy tracking ID"
                title="Copy tracking ID"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="text-center text-sm text-black">
              Please save this tracking ID to check the status of your
              submission.
            </p>
            {currentUserEmail && (
              <p className="text-center text-xs text-black">
                A copy of this tracking ID was sent to {currentUserEmail}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Props for CreateSubmissionDialog component
interface CreateSubmissionDialogProps {
  isOpen: boolean;
  currentStep: "form" | "confirm" | "success";
  stepDirection: "forward" | "backward";
  isSubmitting: boolean;
  trackingIdForSuccess: string | null;
  currentUserEmail: string | undefined;
  modalHeight: number | null;
  contentRef: React.RefObject<HTMLDivElement | null>;
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: "form" | "confirm" | "success") => void;
  renderSubmissionForm: (idPrefix: string, onSubmit?: (e: React.FormEvent) => void) => React.ReactNode;
  renderConfirmSummary: () => React.ReactNode;
  onConfirmSubmit: () => Promise<void>;
  onCopyTrackingId: (text: string) => void;
  onTrackSubmission: (id: string) => Promise<void>;
  onSubmitAnother: () => void;
}

export function CreateSubmissionDialog({
  isOpen,
  currentStep,
  stepDirection,
  isSubmitting,
  trackingIdForSuccess,
  currentUserEmail,
  modalHeight,
  contentRef,
  onOpenChange,
  onStepChange,
  renderSubmissionForm,
  renderConfirmSummary,
  onConfirmSubmit,
  onCopyTrackingId,
  onTrackSubmission,
  onSubmitAnother,
}: CreateSubmissionDialogProps) {
  const animationClass =
    stepDirection === "backward"
      ? "ff-step-slide-in-right"
      : "ff-step-slide-in-left";

  const submissionActionButtonHeightClass = "h-9";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onStepChange("form");
        }
      }}
    >
      <DialogContent
        ref={contentRef}
        className="ff-user-dashboard-theme ff-hide-scrollbar max-h-[93vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-2xl border bg-white p-4 shadow-2xl transition-[height] duration-200 sm:w-full sm:p-6"
        style={
          currentStep === "confirm" && modalHeight
            ? { height: `${modalHeight}px` }
            : undefined
        }
      >
        {currentStep === "form" ? (
          <div
            key={`create-step-form-${stepDirection}`}
            className={animationClass}
          >
            <DialogHeader>
              <DialogTitle>Feedback Form</DialogTitle>
              <DialogDescription className="text-black">
                Fill out the details below to create a new submission.
              </DialogDescription>
            </DialogHeader>
            {renderSubmissionForm("modal", (e: React.FormEvent) => {
              e.preventDefault();
              onStepChange("confirm");
            })}
          </div>
        ) : null}

        {currentStep === "confirm" ? (
          <div
            key={`create-step-confirm-${stepDirection}`}
            className={`${animationClass} flex h-full min-h-0 flex-col`}
          >
            <DialogHeader>
              <DialogTitle>Confirm Your Feedback</DialogTitle>
              <DialogDescription className="text-black">
                Review your details before we send this feedback.
              </DialogDescription>
            </DialogHeader>
            <div className="ff-hide-scrollbar min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {renderConfirmSummary()}
            </div>
            <div className="mx-auto mt-5 h-px w-[92%] bg-border/70" />
            <div className="mt-[10px] mb-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className={`${submissionActionButtonHeightClass} rounded-lg border border-gray-300 sm:min-w-[160px]`}
                onClick={() => onStepChange("form")}
              >
                Back
              </Button>
              <Button
                className={`${submissionActionButtonHeightClass} rounded-lg bg-accent text-white hover:bg-accent/90 sm:min-w-[190px]`}
                onClick={onConfirmSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting feedback..." : "Confirm & Submit"}
              </Button>
            </div>
          </div>
        ) : null}

        {currentStep === "success" ? (
          trackingIdForSuccess ? (
            <div
              key={`create-step-success-${stepDirection}`}
              className={animationClass}
            >
              <FeedbackSuccessCard
                trackingId={trackingIdForSuccess}
                email={currentUserEmail}
                className="w-full max-w-none gap-4 border-0 bg-transparent shadow-none"
                onCopyTrackingId={onCopyTrackingId}
                onTrackSubmission={onTrackSubmission}
                onSubmitAnother={onSubmitAnother}
              />
            </div>
          ) : null
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// Props for ConfirmationDialog component
interface ConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: ConfirmationDialogProps) {
  const submissionActionButtonHeightClass = "h-9";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="ff-user-dashboard-theme flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-lg flex-col overflow-hidden p-5 sm:w-full sm:p-6">
        <DialogHeader>
          <DialogTitle>Confirm Your Feedback</DialogTitle>
          <DialogDescription className="text-black">
            Review your details before we send this feedback.
          </DialogDescription>
        </DialogHeader>
        <div className="mx-auto mt-5 h-px w-[92%] bg-border/70" />
        <div className="mt-[10px] mb-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className={`${submissionActionButtonHeightClass} rounded-lg border border-gray-300 sm:min-w-[160px]`}
            onClick={() => onOpenChange(false)}
          >
            Back
          </Button>
          <Button
            className={`${submissionActionButtonHeightClass} rounded-lg bg-accent text-white hover:bg-accent/90 sm:min-w-[190px]`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Submitting feedback..." : "Confirm & Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Props for DeleteConfirmationDialog component
interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  deleteTarget: Feedback | null;
  onOpenChange: (open: boolean) => void;
  onDelete: (feedback: Feedback) => Promise<void>;
}

export function DeleteConfirmationDialog({
  isOpen,
  deleteTarget,
  onOpenChange,
  onDelete,
}: DeleteConfirmationDialogProps) {
  const handleDelete = async () => {
    if (deleteTarget) {
      await onDelete(deleteTarget);
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
      }}
    >
      <DialogContent className="ff-user-dashboard-theme w-[calc(100%-1rem)] max-w-[320px] rounded-2xl p-5 sm:w-full">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-destructive"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </div>
          <div>
            <DialogTitle className="text-sm font-semibold leading-snug">Delete submission?</DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-relaxed text-black">
              This will permanently remove your pending feedback.
            </DialogDescription>
          </div>
        </div>
        {deleteTarget && (
          <div className="min-w-0 rounded-lg border border-border bg-muted p-3 mb-4">
            <p className="text-xs font-semibold break-words break-all text-foreground">
              {deleteTarget.subject}
            </p>
            <p className="mt-0.5 text-xs break-all text-black">
              {deleteTarget.id}
            </p>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            className="h-8 px-4 text-xs rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-8 px-4 text-xs rounded-lg bg-destructive text-white hover:bg-destructive/90 shadow-none"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Props for UnsentMessageWarning component
interface UnsentMessageWarningProps {
  isOpen: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}

export function UnsentMessageWarning({
  isOpen,
  onKeep,
  onDiscard,
}: UnsentMessageWarningProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="absolute -inset-px z-20 rounded-2x1 bg-black/40 backdrop-blur-[1px]" />
      <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
          <div className="space-y-2 text-left">
            <h2 className="text-lg font-semibold">Discard unsent message?</h2>
            <p className="text-sm text-black">
              You have a message that has not been sent yet.
            </p>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onKeep}>
              Keep
            </Button>
            <Button type="button" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
