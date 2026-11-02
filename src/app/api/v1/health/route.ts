import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { databaseUrl } from "@/db/url";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: databaseUrl() ? "neon" : "pglite" });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
