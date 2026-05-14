import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for static files, login, and auth API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // CSRF protection for state-changing requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json(
        { error: "CSRF: Origin mismatch" },
        { status: 403 }
      );
    }
  }

  const authType = process.env.AUTH_TYPE;
  if (authType === "none") return NextResponse.next();

  // Validate required env vars
  if (!process.env.DASHBOARD_USER) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Server misconfigured: DASHBOARD_USER not set" },
        { status: 500 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = request.cookies.get("session")?.value;
  const expectedUser = process.env.DASHBOARD_USER;

  if (!session || session !== expectedUser) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Set security headers
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
