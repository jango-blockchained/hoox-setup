import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  try {
    const authType = process.env.AUTH_TYPE || "basic";

    if (authType === "none") {
      return NextResponse.next();
    }

    const sessionCookie = request.cookies.get("session");
    const dashboardUser = process.env.DASHBOARD_USER;

    if (sessionCookie && dashboardUser) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized - Dashboard session expired or DASHBOARD_USER missing" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/login", request.url));
  } catch {
    return NextResponse.next();
  }
}