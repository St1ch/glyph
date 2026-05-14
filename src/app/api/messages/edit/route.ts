import { NextResponse } from "next/server";
import { z } from "zod";
import { editDirectMessage, getViewer } from "@/lib/data";

const schema = z.object({
  messageId: z.string().min(1),
  content: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт.");
    }

    const payload = schema.parse(await request.json());
    const result = await editDirectMessage(payload.messageId, viewer.id, payload.content);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось изменить сообщение.",
      },
      { status: 400 },
    );
  }
}
