import { ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FeedbackSuccessCardProps = {
  trackingId: string;
  email?: string | null;
  onCopyTrackingId: (trackingId: string) => void;
  onTrackSubmission: (trackingId: string) => void;
  onSubmitAnother: () => void;
  className?: string;
};

export function FeedbackSuccessCard({
  trackingId,
  email,
  onCopyTrackingId,
  onTrackSubmission,
  onSubmitAnother,
  className,
}: FeedbackSuccessCardProps) {
  return (
    <Card className={className ?? "max-w-lg w-full shadow-lg"}>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
          <ArrowRight className="h-8 w-8 text-accent" />
        </div>
        <CardTitle>Feedback Submitted!</CardTitle>
        <CardDescription>
          Your feedback has been received successfully
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-4 text-center relative">
          <p className="text-sm text-muted-foreground mb-2">
            Your Tracking ID
          </p>
          <p className="text-2xl font-bold text-primary">{trackingId}</p>
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
        <p className="text-sm text-muted-foreground text-center">
          Please save this tracking ID to check the status of your
          submission.
        </p>
        {email ? (
          <p className="text-xs text-muted-foreground text-center">
            A copy of this tracking ID was sent to {email}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            Sign in to receive email updates when your feedback is resolved.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 w-full"
            onClick={() => onTrackSubmission(trackingId)}
          >
            Track Submission
          </Button>
          <Button
            className="flex-1 w-full bg-accent hover:bg-accent/90"
            onClick={onSubmitAnother}
          >
            Submit Another
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}