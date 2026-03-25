"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-slate-50 via-stone-50 to-amber-50">
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/60 bg-white/90 p-10 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-600">
            Error 404
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            That page doesn&apos;t exist.
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            The link may be broken, or the page may have been removed. Try going
            back or return to the dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="border-slate-200"
            >
              Go Back
            </Button>
            <Button type="button" onClick={() => router.push("/")}>
              Go Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
