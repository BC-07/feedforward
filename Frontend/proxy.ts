import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  void _request;
  // Auth is handled client-side via localStorage.
  // Only protect routes that should not be publicly accessible.
  // Allow all public routes through without restriction
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
