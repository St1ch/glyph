import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteAccount, destroySession, getSessionCookieName, getSessionCookieOptions, getViewer } from "@/lib/data";

export async function POST() {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Сначала войдите в аккаунт.");
    }

    const response = NextResponse.json({ ok: true });
    const cookieName = getSessionCookieName();
    const cookieOptions = getSessionCookieOptions();
    const cookieStore = await cookies();
    await destroySession(cookieStore.get(cookieName)?.value ?? null);
    await deleteAccount(viewer.id);

    response.cookies.set({
      name: cookieName,
      value: "",
      ...cookieOptions,
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось удалить аккаунт.",
      },
      { status: 400 },
    );
  }
}
