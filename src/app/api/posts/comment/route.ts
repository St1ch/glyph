import { NextResponse } from "next/server";
import { z } from "zod";
import { createComment, getViewer } from "@/lib/data";

const schema = z.object({
  postId: z.string().min(1),
  content: z.string().trim().max(1000).default(""),
  imagePath: z.string().default(""),
}).superRefine((value, ctx) => {
  if (!value.content.trim() && !value.imagePath.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["content"],
      message: "Добавьте текст или изображение.",
    });
  }
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы оставлять комментарии.");
    }

    const payload = schema.parse(await request.json());
    await createComment(
      payload.postId,
      viewer.id,
      payload.content,
      payload.imagePath.trim() || null,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось отправить комментарий.",
      },
      { status: 400 },
    );
  }
}
