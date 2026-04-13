import { NextResponse } from "next/server";
import { z } from "zod";
import { createClan, getViewer } from "@/lib/data";

const schema = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z.string().trim().max(64).optional().default(""),
  description: z.string().trim().min(12).max(1200),
  avatarEmoji: z.string().trim().min(1).max(16),
  coverImagePath: z.string().trim().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы создать клан.");
    }

    const payload = schema.parse(await request.json());
    const clan = await createClan({
      userId: viewer.id,
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
        error: error instanceof Error ? error.message : "Не удалось создать клан.",
      },
      { status: 400 },
    );
  }
}
