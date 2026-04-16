import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/data";

const schema = z.object({
  name: z.string().trim().min(2),
  handle: z.string().trim().min(2),
  email: z.email().trim(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const result = await registerUser(payload);

    return NextResponse.json({
      message:
        result.delivery === "smtp"
          ? "Аккаунт создан. Письмо для подтверждения уже отправлено на почту. Если его нет во входящих, проверьте папку «Спам»."
          : "Аккаунт создан. SMTP пока не настроен, поэтому используйте ссылку подтверждения ниже.",
      verificationLink: result.delivery === "smtp" ? "" : result.verificationLink,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось зарегистрировать аккаунт.",
      },
      { status: 400 },
    );
  }
}
