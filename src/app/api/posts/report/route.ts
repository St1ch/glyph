import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, reportPost } from "@/lib/data";

const schema = z.object({
  postId: z.string().min(1),
  category: z.enum(["spam", "abuse", "adult", "violence", "misinformation", "other"]),
  details: z.string().trim().max(500).default(""),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы отправить жалобу.");
    }

    const payload = schema.parse(await request.json());
    await reportPost(payload.postId, viewer.id, payload.category, payload.details.trim() || null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось отправить жалобу.",
      },
      { status: 400 },
    );
  }
}
