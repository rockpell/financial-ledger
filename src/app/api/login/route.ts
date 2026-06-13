import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (password !== secret) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }

  const token = await createToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
  return res;
}
