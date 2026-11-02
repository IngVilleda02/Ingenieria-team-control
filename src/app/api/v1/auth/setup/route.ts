import { NextResponse } from "next/server";
import { createSession } from "@/server/auth";
import { handle } from "@/server/http";
import { runSetup } from "@/server/services/setup";

export const POST = handle(async (req: Request) => {
  const created = await runSetup(await req.json());
  await createSession({ ...created, role: "admin" });
  return NextResponse.json({ ok: true }, { status: 201 });
});
