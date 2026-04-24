import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, updateAccountSettings } from "@/lib/data";

const schema = z.object({
  themePreference: z.enum(["light", "dark", "system"]),
  notificationsEnabled: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Сначала войдите в аккаунт.");
    }

    const payload = schema.parse(await request.json());
    const user = await updateAccountSettings(viewer.id, payload);

    return NextResponse.json({
      ok: true,
      user,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось сохранить настройки.",
      },
      { status: 400 },
    );
  }
}
