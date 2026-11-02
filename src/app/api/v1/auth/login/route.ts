import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, login } from "@/server/auth";
import { handle } from "@/server/http";

const body = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });

export const POST = handle(async (req: Request) => {
  const { email, password } = body.parse(await req.json());
  const session = await login(email, password);
  await createSession(session);
  return NextResponse.json({ ok: true });
});
