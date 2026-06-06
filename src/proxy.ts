import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyToken } from "@/lib/auth";

// 인증 없이 접근 가능한 경로(로그인 화면 및 로그인 API).
const PUBLIC_PATHS = ["/login", "/api/login"];

// Next.js 16: middleware → proxy 컨벤션. 모든 요청 진입 전 Edge에서 인증 검증.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const secret = process.env.APP_PASSWORD;
  // 서버에 비밀번호가 설정되지 않았다면 안전하게 전부 차단.
  if (!secret) {
    return redirectToLogin(req, "config");
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const valid = await verifyToken(token, secret);
  if (valid) return NextResponse.next();

  // API 요청은 리다이렉트 대신 401로 즉시 차단(Node 서버리스를 깨우지 않음).
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return redirectToLogin(req);
}

function redirectToLogin(req: NextRequest, reason?: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = reason ? `?reason=${reason}` : "";
  return NextResponse.redirect(url);
}

// 정적 자산/이미지/파비콘을 제외한 모든 경로에 미들웨어 적용.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
