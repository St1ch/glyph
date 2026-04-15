import { NextResponse } from "next/server";
import { getViewer, requestPasswordResetForUser } from "@/lib/data";

export async function POST() {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Сначала войдите в аккаунт.");
    }

    await requestPasswordResetForUser(viewer.id);

    return NextResponse.json({
      ok: true,
      message: "Письмо для смены пароля уже отправлено на вашу почту.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось отправить письмо для смены пароля.",
      },
      { status: 400 },
    );
  }
}
