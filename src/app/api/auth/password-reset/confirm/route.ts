import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordByToken } from "@/lib/data";

const schema = z.object({
  token: z.string().trim().min(10),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    await resetPasswordByToken(payload.token, payload.password);

    return NextResponse.json({
      ok: true,
      message: "Пароль успешно изменён. Теперь можно войти с новым паролем.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось изменить пароль.",
      },
      { status: 400 },
    );
  }
}
