import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getSessionCookieName, getSessionCookieOptions, loginUser } from "@/lib/data";

const schema = z.object({
  login: z.string().trim().min(2),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const user = await loginUser(payload);
    const token = await createSession(user.id);
    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: getSessionCookieName(),
      value: token,
      ...getSessionCookieOptions(),
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось выполнить вход.",
      },
      { status: 400 },
    );
  }
}
