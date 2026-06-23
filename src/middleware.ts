import { NextRequest, NextResponse } from "next/server";

const csrfCookieName = process.env.NODE_ENV === "production" ? "__Host-glyph_csrf" : "glyph_csrf";
const protectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const csrfExemptPaths = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/password-reset/confirm",
  "/api/account/password-reset",
]);

function makeToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

function getAllowedOrigins(request: NextRequest) {
  const origins = new Set([request.nextUrl.origin]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (appUrl) {
    origins.add(appUrl);
  }

  if (request.nextUrl.hostname.startsWith("www.")) {
    origins.add(`${request.nextUrl.protocol}//${request.nextUrl.hostname.slice(4)}`);
  } else {
    origins.add(`${request.nextUrl.protocol}//www.${request.nextUrl.host}`);
  }

  return origins;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(csrfCookieName)?.value || makeToken();

  if (!request.cookies.get(csrfCookieName)) {
    response.cookies.set({
      name: csrfCookieName,
      value: token,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    protectedMethods.has(request.method) &&
    !csrfExemptPaths.has(request.nextUrl.pathname)
  ) {
    const origin = request.headers.get("origin");

    if (origin && !getAllowedOrigins(request).has(origin)) {
      return NextResponse.json({ error: "CSRF origin rejected." }, { status: 403 });
    }

    if (request.headers.get("x-csrf-token") !== token) {
      return NextResponse.json({ error: "CSRF token rejected." }, { status: 403 });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"],
};
