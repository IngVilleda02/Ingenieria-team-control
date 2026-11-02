import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { projectInput, type ProjectInput } from "@/lib/schemas";
import { audit } from "../audit";
import { visibleMemberIds, type Ctx } from "../context";
import { HttpError } from "../errors";
import { listAssignments } from "./activities";
import { projectProjection } from "./indicators";
import { todayIn, weightedCompletion, weightedProgress } from "./metrics";
import { getSettings } from "./settings";

const P = schema.project;
const numStr = (v: number | null | undefined) => (v == null ? null : String(v));

export async function listProjects(c: Ctx, opts: { archived?: boolean; status?: string | null } = {}) {
  const settings = await getSettings();
  const rows = await c.db
    .select()
    .from(P)
    .where(
      and(
        isNull(P.deletedAt),
        opts.archived ? isNotNull(P.archivedAt) : isNull(P.archivedAt),
        opts.status ? eq(P.status, opts.status as "en_progreso") : undefined,
      ),
    )
    .orderBy(asc(sql`coalesce(${P.dueDate}, '9999-12-31')`), asc(P.name));
  const visible = await visibleMemberIds(c);
  const items = await listAssignments(c);
  const owners = await c.db.select({ id: schema.member.id, name: schema.member.fullName }).from(schema.member);
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const today = todayIn(settings.timezone);
  return rows
    .filter((p) => {
      if (visible === null) return true;
      return items.some((i) => i.projectId === p.id) || (p.ownerMemberId && visible.includes(p.ownerMemberId));
    })
    .map((p) => {
      const acts = items.filter((i) => i.projectId === p.id);
      return {
        ...p,
        ownerName: p.ownerMemberId ? ownerName.get(p.ownerMemberId) ?? null : null,
        activityCount: acts.length,
        openCount: acts.filter((a) => !["completada", "cancelada"].includes(a.status)).length,
        overdueCount: acts.filter((a) => a.overdue).length,
        completion: weightedCompletion(acts, settings),
        progress: weightedProgress(acts, settings),
        late: !!p.dueDate && p.dueDate < today && !["completado", "cancelado"].includes(p.status),
      };
    });
}

export async function getProject(c: Ctx, id: string) {
  const [p] = await c.db.select().from(P).where(and(eq(P.id, id), isNull(P.deletedAt)));
  if (!p) throw new HttpError(404, "Proyecto no encontrado.");
  const settings = await getSettings();
  const items = await listAssignments(c, { projectId: id });
  const members = await c.db
    .select({ id: schema.member.id, name: schema.member.fullName, role: schema.projectMember.roleInProject })
    .from(schema.projectMember)
    .innerJoin(schema.member, eq(schema.member.id, schema.projectMember.memberId))
    .where(eq(schema.projectMember.projectId, id));
  const phases = await c.db.select().from(schema.phase).where(eq(schema.phase.projectId, id)).orderBy(asc(schema.phase.order));
  const activityIds = [...new Set(items.map((i) => i.activityId))];
  const phaseOf = activityIds.length
    ? await c.db.select({ id: schema.activity.id, phaseId: schema.activity.phaseId }).from(schema.activity).where(inArray(schema.activity.id, activityIds))
    : [];
  const phaseMap = new Map(phaseOf.map((x) => [x.id, x.phaseId]));
  const evidence = await c.db
    .select()
    .from(schema.evidence)
    .where(and(eq(schema.evidence.projectId, id), isNull(schema.evidence.deletedAt)))
    .orderBy(desc(schema.evidence.createdAt));
  const [owner] = p.ownerMemberId ? await c.db.select().from(schema.member).where(eq(schema.member.id, p.ownerMemberId)) : [];
  const projection = projectProjection(p, items, settings);
  return {
    project: p,
    owner: owner ?? null,
    members,
    phases,
    items: items.map((i) => ({ ...i, phaseId: phaseMap.get(i.activityId) ?? null })),
    evidence,
    metrics: {
      completion: weightedCompletion(items, settings),
      progress: weightedProgress(items, settings),
      ...projection,
    },
  };
}

export async function createProject(c: Ctx, input: ProjectInput) {
  if (c.scope === "own") throw new HttpError(403, "No puedes crear proyectos.");
  const d = projectInput.parse(input);
  return c.db.transaction(async (tx) => {
    const [p] = await tx
      .insert(P)
      .values({
        name: d.name,
        description: d.description ?? null,
        objective: d.objective ?? null,
        category: d.category ?? null,
        ownerMemberId: d.ownerMemberId ?? c.session.memberId,
        priority: d.priority,
        status: d.status,
        startDate: d.startDate ?? null,
        dueDate: d.dueDate ?? null,
        finishedAt: d.finishedAt ?? null,
        budget: numStr(d.budget),
        notes: d.notes ?? null,
        createdBy: c.session.userId,
      })
      .returning();
    const memberIds = [...new Set([...(d.memberIds ?? []), p.ownerMemberId].filter(Boolean) as string[])];
    if (memberIds.length) await tx.insert(schema.projectMember).values(memberIds.map((m) => ({ projectId: p.id, memberId: m }))).onConflictDoNothing();
    await audit(tx, { userId: c.session.userId, entityType: "project", entityId: p.id, action: "create", after: p });
    return p;
  });
}

export async function updateProject(c: Ctx, id: string, input: ProjectInput) {
  if (c.scope === "own") throw new HttpError(403, "No puedes editar proyectos.");
  const d = projectInput.parse(input);
  const [cur] = await c.db.select().from(P).where(eq(P.id, id));
  if (!cur) throw new HttpError(404, "Proyecto no encontrado.");
  const tz = (await getSettings()).timezone;
  const finishedAt = d.status === "completado" ? (d.finishedAt ?? cur.finishedAt ?? todayIn(tz)) : (d.finishedAt ?? null);
  const next = {
    name: d.name,
    description: d.description ?? null,
    objective: d.objective ?? null,
    category: d.category ?? null,
    ownerMemberId: d.ownerMemberId ?? cur.ownerMemberId,
    priority: d.priority,
    status: d.status,
    startDate: d.startDate ?? null,
    dueDate: d.dueDate ?? null,
    finishedAt,
    budget: numStr(d.budget),
    notes: d.notes ?? null,
  };
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) {
    const prev = (cur as Record<string, unknown>)[k];
    if (String(prev ?? "") !== String(v ?? "")) {
      before[k] = prev;
      after[k] = v;
    }
  }
  await c.db.transaction(async (tx) => {
    await tx.update(P).set({ ...next, updatedAt: new Date() }).where(eq(P.id, id));
    if (d.memberIds) {
      await tx.delete(schema.projectMember).where(eq(schema.projectMember.projectId, id));
      const ids = [...new Set([...d.memberIds, next.ownerMemberId].filter(Boolean) as string[])];
      if (ids.length) await tx.insert(schema.projectMember).values(ids.map((m) => ({ projectId: id, memberId: m })));
    }
    if (Object.keys(after).length) await audit(tx, { userId: c.session.userId, entityType: "project", entityId: id, action: "update", before, after });
  });
}

export async function archiveProject(c: Ctx, id: string, archive: boolean) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador puede archivar.");
  await c.db.transaction(async (tx) => {
    await tx.update(P).set({ archivedAt: archive ? new Date() : null }).where(eq(P.id, id));
    await audit(tx, { userId: c.session.userId, entityType: "project", entityId: id, action: archive ? "archive" : "unarchive" });
  });
}

export async function deleteProject(c: Ctx, id: string, confirmName: string) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador puede eliminar.");
  const [p] = await c.db.select().from(P).where(eq(P.id, id));
  if (!p) throw new HttpError(404, "Proyecto no encontrado.");
  if (confirmName.trim() !== p.name) throw new HttpError(422, "Escribe el nombre exacto del proyecto para confirmar.");
  await c.db.transaction(async (tx) => {
    await tx.update(P).set({ deletedAt: new Date() }).where(eq(P.id, id));
    await tx.update(schema.activity).set({ deletedAt: new Date() }).where(eq(schema.activity.projectId, id));
    await audit(tx, { userId: c.session.userId, entityType: "project", entityId: id, action: "delete", before: { name: p.name } });
  });
}

export async function addPhase(c: Ctx, projectId: string, name: string) {
  if (c.scope === "own") throw new HttpError(403, "No puedes editar proyectos.");
  if (name.trim().length < 2) throw new HttpError(422, "Nombre de fase muy corto.");
  const [{ n }] = await c.db.select({ n: sql<number>`count(*)` }).from(schema.phase).where(eq(schema.phase.projectId, projectId));
  return c.db.transaction(async (tx) => {
    const [ph] = await tx.insert(schema.phase).values({ projectId, name: name.trim(), order: Number(n) }).returning();
    await audit(tx, { userId: c.session.userId, entityType: "project", entityId: projectId, action: "phase_add", after: { name: ph.name } });
    return ph;
  });
}

export async function projectOptions(c: Ctx) {
  return c.db
    .select({ id: P.id, name: P.name })
    .from(P)
    .where(and(isNull(P.deletedAt), isNull(P.archivedAt)))
    .orderBy(asc(P.name));
}

export async function phaseOptions(c: Ctx) {
  return c.db.select({ id: schema.phase.id, name: schema.phase.name, projectId: schema.phase.projectId }).from(schema.phase).orderBy(asc(schema.phase.order));
}
