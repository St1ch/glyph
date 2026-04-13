import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, votePost } from "@/lib/data";

const schema = z.object({
  postId: z.string().min(1),
  optionId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы голосовать.");
    }

    const payload = schema.parse(await request.json());
    await votePost(payload.postId, payload.optionId, viewer.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось отправить голос.",
      },
      { status: 400 },
    );
  }
}
