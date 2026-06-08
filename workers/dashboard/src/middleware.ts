import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { secureHeaders } from "@jango-blockchained/hoox-shared/middleware";

/**
 * CSP relaxed for Next.js client-side hydration.
 * Next.js uses inline scripts (RSC payload, bootstrap) and loads
 * JS/CSS from `/_next/static/`. The login page also loads a noise
 * overlay from grainy-gradients.vercel.app (CSS background-image).
 */
const NEXTJS_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://grainy-gradients.vercel.app",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
].join("; ");

/**
 * Apply security headers to any NextResponse.
 * Dashboard uses a relaxed CSP for Next.js client-side hydration.
 */
function withSecurityHeaders(response: NextResponse): NextResponse {
  const headers = secureHeaders({ contentSecurityPolicy: NEXTJS_CSP });
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

function getRedirectUrl(request: NextRequest): string {
  try {
    return new URL("/login", request.url).toString();
  } catch {
    return "/login";
  }
}

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Skip auth for static files, login, and auth API
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/api/auth") ||
      pathname === "/favicon.ico"
    ) {
      return withSecurityHeaders(NextResponse.next());
    }

    // CSRF protection for state-changing requests
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      const origin = request.headers?.get("origin");
      const host = request.headers?.get("host");
      if (origin && host && !origin.includes(host)) {
        return withSecurityHeaders(
          NextResponse.json({ error: "CSRF: Origin mismatch" }, { status: 403 })
        );
      }
    }

    const authType = process.env.AUTH_TYPE;
    if (authType === "none") return withSecurityHeaders(NextResponse.next());

    // Validate required env vars
    if (!process.env.DASHBOARD_USER) {
      if (pathname.startsWith("/api/")) {
        return withSecurityHeaders(
          NextResponse.json(
            { error: "Server misconfigured: DASHBOARD_USER not set" },
            { status: 500 }
          )
        );
      }
      return withSecurityHeaders(
        NextResponse.redirect(getRedirectUrl(request))
      );
    }

    let session: string | undefined;
    try {
      session = request.cookies?.get("session")?.value;
    } catch {
      // If cookie access fails, treat as unauthenticated
    }
    const expectedUser = process.env.DASHBOARD_USER;

    if (!session || session !== expectedUser) {
      if (pathname.startsWith("/api/")) {
        return withSecurityHeaders(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        );
      }
      return withSecurityHeaders(
        NextResponse.redirect(getRedirectUrl(request))
      );
    }

    return withSecurityHeaders(NextResponse.next());
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
