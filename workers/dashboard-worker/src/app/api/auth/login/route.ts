import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = body?.username;
    const password = body?.password;

    const validUsername = process.env.DASHBOARD_USER;
    const validPassword = process.env.DASHBOARD_PASS;

    if (!validUsername || !validPassword) {
      return NextResponse.json({ 
        error: "Auth not configured",
        debug: { hasUser: !!validUsername, hasPass: !!validPassword }
      }, { status: 401 });
    }

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("session", username, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: "Invalid request", details: String(err) }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}