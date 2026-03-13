import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasUserSession = request.cookies.get("ff_user_session")?.value === "1";
  const hasAdminSession = request.cookies.get("ff_admin_session")?.value === "1";
  const hasSuperAdminSession =
    request.cookies.get("ff_superadmin_session")?.value === "1";

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (pathname.startsWith("/superadmin") && !hasSuperAdminSession) {
    return redirectTo("/login");
  }

  if (pathname.startsWith("/dashboard") && !hasAdminSession) {
    return redirectTo("/login");
  }

  if (pathname.startsWith("/user") && !hasUserSession) {
    return redirectTo("/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/superadmin/:path*", "/dashboard/:path*", "/user/:path*"],
};
