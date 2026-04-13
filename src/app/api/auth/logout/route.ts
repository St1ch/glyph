import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { destroySession, getSessionCookieName, getSessionCookieOptions } from "@/lib/data";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (token) {
    await destroySession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getSessionCookieName(),
    value: "",
    ...getSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
