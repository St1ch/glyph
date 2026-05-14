import { NextResponse } from "next/server";
import { imageTypes, uploadLimits, verificationVideoTypes, videoTypes } from "@/lib/site";
import { saveUpload } from "@/lib/data";

export const runtime = "nodejs";

type UploadKind = keyof typeof uploadLimits;

function isAllowed(kind: UploadKind, file: File) {
  if (kind === "verification") {
    return verificationVideoTypes.includes(file.type as (typeof verificationVideoTypes)[number]);
  }

  if (kind === "message") {
    return (
      imageTypes.includes(file.type as (typeof imageTypes)[number]) ||
      videoTypes.includes(file.type as (typeof videoTypes)[number])
    );
  }

  return imageTypes.includes(file.type as (typeof imageTypes)[number]);
}

function getUploadError(kind: UploadKind, type: "format" | "size") {
  if (type === "format") {
    if (kind === "verification") {
      return "Поддерживаются только видео MP4, WebM или MOV.";
    }

    if (kind === "message") {
      return "Поддерживаются изображения JPG, PNG, WEBP, GIF, HEIC, HEIF и видео MP4, WebM, MOV.";
    }

    return "Поддерживаются изображения JPG, PNG, WEBP, GIF, HEIC и HEIF.";
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

  if (kind === "message") {
    return "Файл слишком большой. Максимальный размер вложения в сообщении — 50 МБ.";
  }

  return "Изображение слишком большое. Максимальный размер — 8 МБ.";
}

function isUploadKind(value: string): value is UploadKind {
  return ["avatar", "cover", "post", "message", "verification"].includes(value);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") || "");

    if (!(file instanceof File)) {
      throw new Error("Файл не найден.");
    }

    if (!isUploadKind(kind)) {
      throw new Error("Неизвестный тип загрузки.");
    }

    if (!isAllowed(kind, file)) {
      throw new Error(getUploadError(kind, "format"));
    }

    const maxSize = uploadLimits[kind];

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
