import { NextResponse } from "next/server";
import { imageTypes, uploadLimits, verificationVideoTypes } from "@/lib/site";
import { saveUpload } from "@/lib/data";

export const runtime = "nodejs";

function isAllowed(kind: string, file: File) {
  if (kind === "verification") {
    return verificationVideoTypes.includes(file.type as (typeof verificationVideoTypes)[number]);
  }

  return imageTypes.includes(file.type as (typeof imageTypes)[number]);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") || "");

    if (!(file instanceof File)) {
      throw new Error("Файл не найден.");
    }

    if (!["avatar", "cover", "post", "verification"].includes(kind)) {
      throw new Error("Неизвестный тип загрузки.");
    }

    if (!isAllowed(kind, file)) {
      throw new Error("Формат файла не поддерживается.");
    }

    const maxSize = uploadLimits[kind as keyof typeof uploadLimits];

    if (file.size > maxSize) {
      throw new Error("Файл превышает допустимый размер.");
    }

    const relativePath = await saveUpload(file, kind);

    return NextResponse.json({
      path: `/api/assets/${relativePath}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось загрузить файл.",
      },
      { status: 400 },
    );
  }
}
