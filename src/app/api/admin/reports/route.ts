import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminData, getViewer, reviewPostReport } from "@/lib/data";

const schema = z.object({
  reportId: z.string().min(1),
  decision: z.enum(["resolved", "dismissed"]),
});

const statusSchema = z.enum(["new", "approved", "rejected", "all"]).default("all");
const pageSize = 15;

export async function GET(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer?.isAdmin) {
      throw new Error("Недостаточно прав для модерации жалоб.");
    }

    const url = new URL(request.url);
    const status = statusSchema.parse(url.searchParams.get("status") || "all");
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const data = await getAdminData("");
    const reports = data.reports.filter((report) => {
      if (status === "new") return report.status === "open";
      if (status === "approved") return report.status === "resolved";
      if (status === "rejected") return report.status === "dismissed";
      return true;
    });
    const total = reports.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;

    return NextResponse.json({
      reports: reports.slice(startIndex, startIndex + pageSize),
      total,
      page: safePage,
      totalPages,
      pageSize,
      status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось получить жалобы.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();

    if (!viewer?.isAdmin) {
      throw new Error("Недостаточно прав для модерации жалоб.");
    }

    const payload = schema.parse(await request.json());
    await reviewPostReport(payload.reportId, payload.decision, viewer.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось обработать жалобу.",
      },
      { status: 400 },
    );
  }
}
