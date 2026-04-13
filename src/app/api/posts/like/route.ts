import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, toggleLike } from "@/lib/data";

const schema = z.object({
  postId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы ставить лайки.");
    }

    const { postId } = schema.parse(await request.json());
    await toggleLike(postId, viewer.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось обновить лайк.",
      },
      { status: 400 },
    );
  }
}
