import { type Feedback } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { CheckCircle, Circle, Clock, Wrench } from "lucide-react";

type FeedbackStatusCardProps = {
  feedback: Feedback;
  formatDate: (dateString: string) => string;
  className?: string;
};

function normalizeStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getStatusIndicatorClass(status: string): string {
  switch (normalizeStatus(status)) {
    case "pending":
      return "border-amber-300/80 bg-amber-50 text-amber-700";
    case "in progress":
      return "border-orange-300/80 bg-orange-50 text-orange-700";
    case "resolved":
      return "border-emerald-300/80 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-300/80 bg-slate-50 text-slate-700";
  }
}

function getStatusIcon(status: string) {
  switch (normalizeStatus(status)) {
    case "pending":
      return Clock;
    case "in progress":
      return Wrench;
    case "resolved":
      return CheckCircle;
    default:
      return Circle;
  }
}

function getPriorityClass(priority: string): string {
  const normalized = priority.trim().toLowerCase();
  if (normalized === "high") return "border-red-200 bg-red-50 text-red-700";
  if (normalized === "medium") return "border-yellow-200 bg-yellow-50 text-yellow-700";
  if (normalized === "low") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function FeedbackStatusCard({ feedback, formatDate, className }: FeedbackStatusCardProps) {
  const StatusIcon = getStatusIcon(feedback.status);

  return (
    <Card className={cn("shadow-lg", className)}>
      <CardHeader>
        <CardTitle>Submission Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
            <div className="mt-2">
              <Badge className={cn("gap-2 border", getStatusIndicatorClass(feedback.status))}>
                <StatusIcon className="h-3.5 w-3.5" />
                {feedback.status}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Priority</p>
            <div className="mt-2">
              <Badge className={cn("border", getPriorityClass(feedback.priority || ""))}>
                {feedback.priority || "Not set"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tracking ID</p>
          <p className="mt-1 font-mono text-sm">{feedback.id}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <span className="font-medium text-foreground">Submitted:</span> {formatDate(feedback.createdAt)}
          </div>
          <div>
            <span className="font-medium text-foreground">Last updated:</span> {formatDate(feedback.updatedAt)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
