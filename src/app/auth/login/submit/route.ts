import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getSessionCookieName, getSessionCookieOptions, loginUser } from "@/lib/data";

const schema = z.object({
  login: z.string().trim().min(2),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const url = new URL(request.url);

  try {
    const formData = await request.formData();
    const payload = schema.parse({
      login: formData.get("login"),
      password: formData.get("password"),
    });

    const user = await loginUser(payload);
    const token = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", url), 303);

    response.cookies.set({
      name: getSessionCookieName(),
      value: token,
      ...getSessionCookieOptions(),
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить вход.";
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(message)}`, url),
      303,
    );
  }
}
