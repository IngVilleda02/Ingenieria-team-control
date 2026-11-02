import { NextResponse } from "next/server";
import { ctx } from "@/server/context";
import { handle } from "@/server/http";
import { getEvidenceForDownload } from "@/server/services/evidence";
import { readFile } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Descarga con verificación de permiso. Imágenes y PDF se muestran en línea; el resto se descarga. */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const c = await ctx("evidence.view");
  const e = await getEvidenceForDownload(c, id);
  const data = await readFile(e.storageKey);
  if ("redirect" in data) return NextResponse.redirect(data.redirect);
  const inline = (e.mime.startsWith("image/") || e.mime === "application/pdf") && !new URL(req.url).searchParams.has("descargar");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": e.mime,
      "content-length": String(data.length),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(e.originalName)}`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "cache-control": "private, max-age=300",
    },
  });
});
