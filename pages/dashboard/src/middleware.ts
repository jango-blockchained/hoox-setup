import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
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

    return NextResponse.redirect(new URL("/login", request.url));
  } catch {
    return NextResponse.next();
  }
}