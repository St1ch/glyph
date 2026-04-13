import path from "node:path";
import { NextResponse } from "next/server";
import { readUpload } from "@/lib/data";

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
    const buffer = await readUpload(relativePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": getContentType(relativePath),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
