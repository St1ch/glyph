import { NextResponse } from "next/server";
import { getUnreadNotificationCount, getViewer } from "@/lib/data";

export async function GET() {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ count: 0 });
  }

  const count = await getUnreadNotificationCount(viewer.id);
  return NextResponse.json({ count });
}
