import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, reviewPostReport } from "@/lib/data";

const schema = z.object({
  reportId: z.string().min(1),
  decision: z.enum(["resolved", "dismissed"]),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer?.isAdmin) {
      throw new Error("Недостаточно прав для модерации жалоб.");
    }

    const payload = schema.parse(await request.json());
    await reviewPostReport(payload.reportId, payload.decision, viewer.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось обработать жалобу.",
      },
      { status: 400 },
    );
  }
}
