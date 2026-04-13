import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, toggleClanMembership } from "@/lib/data";

const schema = z.object({
  slug: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы вступать в кланы.");
    }

    const { slug } = schema.parse(await request.json());
    await toggleClanMembership(slug, viewer.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось обновить статус в клане.",
      },
      { status: 400 },
    );
  }
}
