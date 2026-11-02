import { NextResponse } from "next/server";
import { requirePermission } from "@/server/auth";
import { handle } from "@/server/http";
import { getDashboard } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const { session, scope } = await requirePermission("dashboard.view");
  return NextResponse.json(await getDashboard(session, scope));
});
