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

function getUploadError(kind: string, type: "format" | "size") {
  if (type === "format") {
    if (kind === "verification") {
      return "Поддерживаются только видео MP4, WebM или MOV.";
    }

    return "Поддерживаются только изображения JPG, PNG, WEBP и GIF.";
  }

  if (kind === "verification") {
    return "Видео слишком большое. Максимальный размер — 50 МБ.";
  }

  if (kind === "avatar") {
    return "Изображение слишком большое. Максимальный размер для аватара — 5 МБ.";
  }

  if (kind === "cover") {
    return "Изображение слишком большое. Максимальный размер для обложки — 8 МБ.";
  }

  return "Изображение слишком большое. Максимальный размер — 8 МБ.";
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
      throw new Error(getUploadError(kind, "format"));
    }

    const maxSize = uploadLimits[kind as keyof typeof uploadLimits];

    if (file.size > maxSize) {
      throw new Error(getUploadError(kind, "size"));
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
