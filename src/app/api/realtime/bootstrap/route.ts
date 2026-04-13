import { NextResponse } from "next/server";
import { getViewer } from "@/lib/data";
import { getRealtimeConnectionUrl } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ url: null }, { status: 401 });
  }

  const url = await getRealtimeConnectionUrl(request);
  return NextResponse.json({ url });
}
