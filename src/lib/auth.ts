// Edge 런타임에서 동작하는 HMAC 기반 서명 토큰 유틸.
// Node 전용 모듈(crypto, fs)을 쓰지 않고 Web Crypto(subtle)만 사용한다.

export const AUTH_COOKIE = "fl_auth";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30일 자동 로그인 유지

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

// 비밀번호(secret)로 서명된 토큰 생성. payload = 만료 시각(ms).
export async function createToken(secret: string): Promise<string> {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const sig = toBase64Url(await hmac(secret, exp));
  return `${exp}.${sig}`;
}

// 상수 시간 비교로 타이밍 공격 방지.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 토큰 유효성 검증: 서명 일치 + 미만료.
export async function verifyToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  const expected = toBase64Url(await hmac(secret, exp));
  return timingSafeEqual(sig, expected);
}
