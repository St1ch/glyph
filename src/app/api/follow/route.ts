import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, toggleFollow } from "@/lib/data";

const schema = z.object({
  handle: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы подписываться.");
    }

    const { handle } = schema.parse(await request.json());
    await toggleFollow(handle, viewer.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось обновить подписку.",
      },
      { status: 400 },
    );
  }
}
