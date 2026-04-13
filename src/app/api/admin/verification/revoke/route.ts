import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, revokeVerification } from "@/lib/data";

const schema = z.object({
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer?.isAdmin) {
      throw new Error("Недостаточно прав для отзыва верификации.");
    }

    const payload = schema.parse(await request.json());
    await revokeVerification(payload.userId, viewer.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось отозвать верификацию.",
      },
      { status: 400 },
    );
  }
}
