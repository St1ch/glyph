import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePostAsAdmin, getViewer } from "@/lib/data";

const schema = z.object({
  postId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer?.isAdmin) {
      throw new Error("Недостаточно прав для удаления постов.");
    }

    const payload = schema.parse(await request.json());
    await deletePostAsAdmin(payload.postId, viewer.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось удалить пост.",
      },
      { status: 400 },
    );
  }
}
