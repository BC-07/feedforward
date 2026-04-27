"use client";

import type { ReactNode } from "react";
import type { Feedback } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TrackingIdSuccessProps = {
  trackingId: string | null;
  currentUserEmail?: string;
  onClose: () => void;
  onCopyTrackingId: (value: string) => void;
};

export function TrackingIdSuccess({
  trackingId,
  currentUserEmail,
  onClose,
  onCopyTrackingId,
}: TrackingIdSuccessProps) {
  return (
    <Dialog open={Boolean(trackingId)} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submission Created</DialogTitle>
          <DialogDescription>
            Save your tracking ID to follow updates.
          </DialogDescription>
        </DialogHeader>
        {trackingId ? (
          <div className="space-y-4">
            <p className="rounded-md border bg-muted px-3 py-2 font-mono text-sm">{trackingId}</p>
            {currentUserEmail ? (
              <p className="text-xs text-muted-foreground">
                A confirmation was sent to {currentUserEmail}.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onCopyTrackingId(trackingId)}>
                Copy
              </Button>
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type ConfirmationDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function ConfirmationDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit this feedback?</AlertDialogTitle>
          <AlertDialogDescription>
            Please confirm before sending your feedback.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isLoading} onClick={onConfirm}>
            {isLoading ? "Submitting..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DeleteConfirmationDialogProps = {
  isOpen: boolean;
  deleteTarget: Feedback | null;
  onOpenChange: (open: boolean) => void;
  onDelete: (feedback: Feedback) => void | Promise<void>;
};

export function DeleteConfirmationDialog({
  isOpen,
  deleteTarget,
  onOpenChange,
  onDelete,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete submission?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget
              ? `This will permanently remove ${deleteTarget.id}.`
              : "This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deleteTarget) {
                void onDelete(deleteTarget);
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type CreateSubmissionDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
};

export function CreateSubmissionDialog({
  isOpen,
  onOpenChange,
  title = "Feedback Form",
  description,
  children,
}: CreateSubmissionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-2xl sm:w-full">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

type UnsentMessageWarningProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onContinue: () => void;
};

export function UnsentMessageWarning({
  isOpen,
  onOpenChange,
  onDiscard,
  onContinue,
}: UnsentMessageWarningProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved message</AlertDialogTitle>
          <AlertDialogDescription>
            You have a message draft. Do you want to discard it?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onContinue}>Keep Editing</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
