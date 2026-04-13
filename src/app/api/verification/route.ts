import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, submitVerification } from "@/lib/data";

const schema = z.object({
  reason: z.string().trim().min(20),
  consent: z.literal(true),
  videoPath: z.string().startsWith("/api/assets/"),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      throw new Error("Сначала войдите в аккаунт.");
    }

    const payload = schema.parse(await request.json());
    await submitVerification({
      userId: viewer.id,
      reason: payload.reason,
      consent: payload.consent,
      videoPath: payload.videoPath,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось отправить заявку.",
      },
      { status: 400 },
    );
  }
}
