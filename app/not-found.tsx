import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4 bg-gradient-to-br from-white to-muted">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold">Page Not Found</h1>
        <p className="mt-3 text-muted-foreground">
          The URL you entered is invalid or the page does not exist.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Please check the link and try again.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/">Go to Home</Link>
          </Button>
          <Button asChild className="bg-accent hover:bg-accent/90">
            <Link href="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
