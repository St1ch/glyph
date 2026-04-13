import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, updateProfile } from "@/lib/data";

const schema = z.object({
  name: z.string().trim().min(2),
  bio: z.string().trim().min(2),
  avatarEmoji: z.string().default(""),
  coverImagePath: z.string().default(""),
  themePreference: z.enum(["light", "dark", "system"]),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Сначала войдите в аккаунт.");
    }

    const payload = schema.parse(await request.json());
    await updateProfile(viewer.id, payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось обновить профиль.",
      },
      { status: 400 },
    );
  }
}
