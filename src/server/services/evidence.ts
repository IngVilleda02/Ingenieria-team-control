import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { schema } from "@/db/client";
import { audit } from "../audit";
import { assertMemberVisible, visibleMemberIds, type Ctx } from "../context";
import { HttpError } from "../errors";
import { cloudStorage, putFile } from "../storage";
import { ALLOWED, MAX_CLOUD_MB, MAX_LOCAL_MB } from "./evidence-rules";

const E = schema.evidence;

/** Verifica la firma real del archivo para los tipos más comunes (no solo la extensión). */
function sniff(buf: Buffer, ext: string): boolean {
  const hex = buf.subarray(0, 8).toString("hex");
  if (["jpg", "jpeg"].includes(ext)) return hex.startsWith("ffd8ff");
  if (ext === "png") return hex.startsWith("89504e47");
  if (ext === "gif") return hex.startsWith("47494638");
  if (ext === "webp") return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  if (ext === "pdf") return buf.subarray(0, 5).toString() === "%PDF-";
  if (["xlsx", "docx", "pptx", "zip", "zap17"].includes(ext)) return hex.startsWith("504b0304") || hex.startsWith("504b0506");
  if (["doc", "xls"].includes(ext)) return hex.startsWith("d0cf11e0");
  return true;
}

export async function uploadEvidence(
  c: Ctx,
  file: File,
  meta: { activityId?: string | null; projectId?: string | null; memberId?: string | null; description?: string | null },
) {
  if (!file || file.size === 0) throw new HttpError(422, "Elige un archivo.");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!(ext in ALLOWED)) throw new HttpError(422, `Tipo de archivo no permitido (.${ext}).`);
  const maxMb = cloudStorage() ? MAX_CLOUD_MB : MAX_LOCAL_MB;
  if (file.size > maxMb * 1024 * 1024) throw new HttpError(422, `El archivo supera ${maxMb} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniff(buf, ext)) throw new HttpError(422, "El contenido del archivo no corresponde a su extensión.");
  if (meta.memberId) await assertMemberVisible(c, meta.memberId);
  let projectId = meta.projectId ?? null;
  if (meta.activityId) {
    const [a] = await c.db.select({ projectId: schema.activity.projectId }).from(schema.activity).where(eq(schema.activity.id, meta.activityId));
    if (!a) throw new HttpError(404, "Actividad no encontrada.");
    projectId = projectId ?? a.projectId;
  }
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const key = `${projectId ?? "general"}/${meta.activityId ?? "sin-actividad"}/${randomUUID()}.${ext}`;
  const mime = file.type && ALLOWED[ext].includes(file.type) ? file.type : (ALLOWED[ext][0] ?? "application/octet-stream");
  const storageKey = await putFile(key, buf, mime);
  return c.db.transaction(async (tx) => {
    const [ev] = await tx
      .insert(E)
      .values({
        activityId: meta.activityId ?? null,
        projectId,
        memberId: meta.memberId || c.session.memberId,
        storageKey,
        originalName: safeName,
        mime,
        sizeBytes: file.size,
        sha256,
        description: meta.description ?? null,
        createdBy: c.session.userId,
      })
      .returning();
    await audit(tx, { userId: c.session.userId, entityType: meta.activityId ? "activity" : "project", entityId: meta.activityId ?? projectId, action: "evidence", after: { evidenceId: ev.id, name: safeName, sha256 } });
    return ev;
  });
}

export async function listEvidence(c: Ctx, f: { projectId?: string | null; memberId?: string | null; activityId?: string | null; from?: string | null; to?: string | null; type?: string | null } = {}) {
  const ids = await visibleMemberIds(c);
  const rows = await c.db
    .select({
      e: E,
      activityTitle: schema.activity.title,
      projectName: schema.project.name,
      memberName: schema.member.fullName,
    })
    .from(E)
    .leftJoin(schema.activity, eq(schema.activity.id, E.activityId))
    .leftJoin(schema.project, eq(schema.project.id, E.projectId))
    .leftJoin(schema.member, eq(schema.member.id, E.memberId))
    .where(
      and(
        isNull(E.deletedAt),
        f.projectId ? eq(E.projectId, f.projectId) : undefined,
        f.memberId ? eq(E.memberId, f.memberId) : undefined,
        f.activityId ? eq(E.activityId, f.activityId) : undefined,
        f.from ? gte(E.createdAt, new Date(`${f.from}T00:00:00`)) : undefined,
        f.to ? lte(E.createdAt, new Date(`${f.to}T23:59:59`)) : undefined,
      ),
    )
    .orderBy(desc(E.createdAt));
  return rows
    .filter((r) => ids === null || (r.e.memberId && ids.includes(r.e.memberId)))
    .filter((r) => !f.type || (f.type === "imagen" ? r.e.mime.startsWith("image/") : !r.e.mime.startsWith("image/")));
}

export async function getEvidenceForDownload(c: Ctx, id: string) {
  const [e] = await c.db.select().from(E).where(and(eq(E.id, id), isNull(E.deletedAt)));
  if (!e) throw new HttpError(404, "Evidencia no encontrada.");
  if (e.memberId) await assertMemberVisible(c, e.memberId);
  return e;
}

export async function deleteEvidence(c: Ctx, id: string) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador elimina evidencias.");
  const [e] = await c.db.select().from(E).where(eq(E.id, id));
  if (!e) throw new HttpError(404, "Evidencia no encontrada.");
  await c.db.transaction(async (tx) => {
    await tx.update(E).set({ deletedAt: new Date() }).where(eq(E.id, id));
    await audit(tx, { userId: c.session.userId, entityType: e.activityId ? "activity" : "project", entityId: e.activityId ?? e.projectId, action: "evidence_delete", before: { name: e.originalName } });
  });
}
