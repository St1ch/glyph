import { NextResponse } from "next/server";
import { z } from "zod";
import { createPost, getViewer } from "@/lib/data";

const schema = z.object({
  content: z.string().default(""),
  imagePath: z.string().default(""),
  pollQuestion: z.string().default(""),
  pollOptions: z.array(z.string().nullable().optional()).default([]),
  repostOfPostId: z.string().default(""),
  groupSlug: z.string().default(""),
}).superRefine((value, ctx) => {
  const content = value.content.trim();
  const isRepost = Boolean(value.repostOfPostId.trim());

  if (!isRepost && content.length < 4) {
    ctx.addIssue({
      code: "custom",
      path: ["content"],
      message: "Напишите хотя бы 4 символа.",
    });
  }
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Сначала войдите в аккаунт.");
    }

    const payload = schema.parse(await request.json());
    await createPost({
      userId: viewer.id,
      content: payload.content.trim(),
      imagePath: payload.imagePath,
      pollQuestion: payload.pollQuestion,
      pollOptions: payload.pollOptions.map((entry) => entry?.trim() || "").filter(Boolean),
      repostOfPostId: payload.repostOfPostId.trim() || null,
      groupSlug: payload.groupSlug.trim() || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось создать пост.",
      },
      { status: 400 },
    );
  }
}
