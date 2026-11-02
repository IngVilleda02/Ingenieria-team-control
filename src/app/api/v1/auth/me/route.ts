import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth";
import { handle } from "@/server/http";

export const GET = handle(async () => NextResponse.json(await requireSession()));
