import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteDirectMessageForAll, deleteDirectMessageForMe, getViewer } from "@/lib/data";

const schema = z.object({
  messageId: z.string().min(1),
  scope: z.enum(["me", "all"]),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт.");
    }

    const payload = schema.parse(await request.json());
    const result =
      payload.scope === "all"
        ? await deleteDirectMessageForAll(payload.messageId, viewer.id)
        : await deleteDirectMessageForMe(payload.messageId, viewer.id);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось удалить сообщение.",
      },
      { status: 400 },
    );
  }
}
