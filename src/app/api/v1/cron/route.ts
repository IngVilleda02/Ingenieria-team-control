import { NextResponse } from "next/server";
import { syncNotifications } from "@/server/services/reminders";

export const dynamic = "force-dynamic";

/** Vercel Cron: genera recordatorios y alertas aunque nadie tenga la app abierta. Protegido con CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const created = await syncNotifications();
  return NextResponse.json({ ok: true, created });
}
