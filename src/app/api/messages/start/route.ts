import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, startDirectConversation } from "@/lib/data";

const schema = z.object({
  handle: z.string().trim().min(1).max(64),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Войдите в аккаунт, чтобы начать диалог.");
    }

    const payload = schema.parse(await request.json());
    const result = await startDirectConversation(viewer.id, payload.handle);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось открыть диалог.",
      },
      { status: 400 },
    );
  }
}
