import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, reviewVerificationRequest } from "@/lib/data";

const schema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer?.isAdmin) {
      throw new Error("Недостаточно прав для модерации верификации.");
    }

    const payload = schema.parse(await request.json());
    await reviewVerificationRequest(payload.requestId, payload.decision, viewer.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось обработать заявку.",
      },
      { status: 400 },
    );
  }
}
