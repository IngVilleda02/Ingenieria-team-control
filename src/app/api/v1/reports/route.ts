import { NextResponse } from "next/server";
import { ctx } from "@/server/context";
import { handle } from "@/server/http";
import { HttpError } from "@/server/errors";
import { fmtDateTime } from "@/lib/format";
import { buildReport, periodFrom, toPdf, toXlsx, type ReportKind } from "@/server/services/reports";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const kind = (q.get("tipo") ?? "general") as ReportKind;
  if (!["general", "individual", "proyecto"].includes(kind)) throw new HttpError(422, "Tipo de reporte no válido.");
  const c = await ctx("metrics.view");
  const period = await periodFrom(q.get("periodo") ?? "semanal", q.get("desde"), q.get("hasta"));
  const report = await buildReport(c, kind, period, q.get("objetivo"));
  const stamp = fmtDateTime(new Date());
  const base = `${report.title}-${period.to}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").slice(0, 80);
  if (q.get("formato") === "xlsx") {
    const buf = await toXlsx(report, stamp);
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${base}.xlsx"` } });
  }
  const buf = await toPdf(report, stamp);
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${base}.pdf"` } });
});
