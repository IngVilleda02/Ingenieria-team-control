import { NextResponse } from "next/server";
import { ctx } from "@/server/context";
import { handle } from "@/server/http";
import { exportAll } from "@/server/services/backup";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const c = await ctx("settings.manage");
  const dump = await exportAll(c);
  const name = `respaldo-team-control-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  return new NextResponse(JSON.stringify(dump), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${name}"` } });
});
