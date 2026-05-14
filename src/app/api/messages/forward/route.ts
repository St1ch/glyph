import { NextResponse } from "next/server";
import { z } from "zod";
import { forwardDirectMessage, getViewer } from "@/lib/data";

const schema = z.object({
  messageId: z.string().min(1),
  conversationId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт.");
    }

    const payload = schema.parse(await request.json());
    const result = await forwardDirectMessage(payload.messageId, payload.conversationId, viewer.id);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось переслать сообщение.",
      },
      { status: 400 },
    );
  }
}
