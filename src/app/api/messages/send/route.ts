import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, sendDirectMessage } from "@/lib/data";

const schema = z.object({
  conversationId: z.string().min(1),
  content: z.string().default("").transform((value) => value.trim()).pipe(z.string().max(2000)),
  mediaPath: z.string().default(""),
  mediaPaths: z.array(z.string()).default([]),
  replyToMessageId: z.string().default(""),
}).superRefine((value, ctx) => {
  if (!value.content && !value.mediaPath.trim() && !value.mediaPaths.some((path) => path.trim())) {
    ctx.addIssue({
      code: "custom",
      path: ["content"],
      message: "Напишите сообщение или прикрепите файл.",
    });
  }
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы отправить сообщение.");
    }

    const payload = schema.parse(await request.json());
    const result = await sendDirectMessage(
      payload.conversationId,
      viewer.id,
      payload.content,
      payload.mediaPath,
      payload.mediaPaths,
      payload.replyToMessageId,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось отправить сообщение.",
      },
      { status: 400 },
    );
  }
}
