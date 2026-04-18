import path from "node:path";
import { NextResponse } from "next/server";
import heicConvert from "heic-convert";
import { readUpload } from "@/lib/data";
import { detectImageFormat } from "@/lib/image-signature";

export const runtime = "nodejs";

function getContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".heic":
    case ".heif":
      return "image/jpeg";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}

type AssetRouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_: Request, context: AssetRouteContext) {
  try {
    const { path: pathParts } = await context.params;
    const relativePath = pathParts.join("/");
    const sourceBuffer = await readUpload(relativePath);
    const detectedFormat = detectImageFormat(sourceBuffer);
    const buffer =
      detectedFormat === "heic"
        ? Buffer.from(
            await heicConvert({
              buffer: sourceBuffer,
              format: "JPEG",
              quality: 0.92,
            }),
          )
        : sourceBuffer;
    const contentType = detectedFormat === "heic" ? "image/jpeg" : getContentType(detectedFormat ? `file.${detectedFormat}` : relativePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
