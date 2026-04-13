import { NextResponse } from "next/server";
import { getLiveNotifications } from "@/lib/data";

export async function GET() {
  const { viewer, items } = await getLiveNotifications();

  if (!viewer) {
    return NextResponse.json({ items: [] });
  }

  return NextResponse.json({ items });
}
