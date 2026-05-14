import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, updateClan } from "@/lib/data";

const schema = z.object({
  currentSlug: z.string().trim().min(1),
  name: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(3).max(64),
  description: z.string().trim().min(12).max(1200),
  avatarEmoji: z.string().trim().min(1).max(16),
  coverImagePath: z.string().trim().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы редактировать клан.");
    }

    const payload = schema.parse(await request.json());
    const clan = await updateClan({
      userId: viewer.id,
      currentSlug: payload.currentSlug,
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      avatarEmoji: payload.avatarEmoji,
      coverImagePath: payload.coverImagePath,
    });

    return NextResponse.json({
      ok: true,
      slug: clan.slug,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось обновить клан.",
      },
      { status: 400 },
    );
  }
}
