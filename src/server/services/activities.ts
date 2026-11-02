import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { activityInput, zStatus, type ActivityInput } from "@/lib/schemas";
import { audit } from "../audit";
import { andAll, assertMemberVisible, assignmentScope, type Ctx } from "../context";
import { HttpError } from "../errors";
import { isOverdue, todayIn } from "./metrics";
import { getSetting } from "./settings";

const A = schema.activity;
const AS = schema.activityAssignment;
const num = (v: string | null) => (v == null ? null : Number(v));
const toNumStr = (v: number | null | undefined) => (v == null ? null : String(v));

export type ActivityFilters = {
  origin?: string | null;
  memberId?: string | null;
  projectId?: string | null;
  status?: string | null; // incluye "vencida" (calculada) y "abiertas"
  priority?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
};

export type AssignmentRow = Awaited<ReturnType<typeof listAssignments>>[number];

/** Una fila por responsable: el estado, avance y horas son de cada persona. */
export async function listAssignments(c: Ctx, f: ActivityFilters = {}) {
  const tz = await getSetting("timezone");
  const today = todayIn(tz);
  const scope = await assignmentScope(c);
  const statusFilter =
    f.status === "abiertas"
      ? sql`${AS.status} not in ('completada','cancelada')`
      : f.status === "vencida"
        ? and(sql`${AS.status} not in ('completada','cancelada')`, sql`${A.dueDate} < ${today}`)
        : f.status
          ? eq(AS.status, zStatus.parse(f.status))
          : undefined;
  const rows = await c.db
    .select({
      assignmentId: AS.id,
      activityId: A.id,
      title: A.title,
      description: A.description,
      origin: A.origin,
      priority: A.priority,
      complexity: A.complexity,
      estimatedH: A.estimatedH,
      startDate: A.startDate,
      dueDate: A.dueDate,
      plannedStart: A.plannedStart,
      plannedEnd: A.plannedEnd,
      assignedAt: A.assignedAt,
      evidenceRequired: A.evidenceRequired,
      status: AS.status,
      progressPct: AS.progressPct,
      startedAt: AS.startedAt,
      finishedAt: AS.finishedAt,
      actualH: AS.actualH,
      memberId: schema.member.id,
      memberName: schema.member.fullName,
      memberIsAdmin: schema.member.isAdmin,
      projectId: schema.project.id,
      projectName: schema.project.name,
    })
    .from(AS)
    .innerJoin(A, eq(A.id, AS.activityId))
    .innerJoin(schema.member, eq(schema.member.id, AS.memberId))
    .leftJoin(schema.project, eq(schema.project.id, A.projectId))
    .where(
      andAll(
        isNull(A.deletedAt),
        scope,
        f.origin ? eq(A.origin, f.origin as "personal") : undefined,
        f.memberId ? eq(AS.memberId, f.memberId) : undefined,
        f.projectId ? eq(A.projectId, f.projectId) : undefined,
        f.priority ? eq(A.priority, f.priority as "media") : undefined,
        statusFilter,
        f.from ? or(gte(A.dueDate, f.from), and(isNull(A.dueDate), gte(A.startDate, f.from))) : undefined,
        f.to ? or(lte(A.startDate, f.to), and(isNull(A.startDate), lte(A.dueDate, f.to))) : undefined,
        f.q ? ilike(A.title, `%${f.q.replace(/[%_]/g, "")}%`) : undefined,
      ),
    )
    .orderBy(asc(sql`coalesce(${A.dueDate}, '9999-12-31')`), desc(A.priority), asc(A.title));
  return rows.map((r) => ({
    ...r,
    estimatedH: num(r.estimatedH),
    actualH: num(r.actualH),
    overdue: isOverdue({ dueDate: r.dueDate, status: r.status }, today),
  }));
}

export async function getActivity(c: Ctx, id: string) {
  const [a] = await c.db.select().from(A).where(and(eq(A.id, id), isNull(A.deletedAt)));
  if (!a) throw new HttpError(404, "Actividad no encontrada.");
  const assignments = await c.db
    .select({ a: AS, memberName: schema.member.fullName, memberIsAdmin: schema.member.isAdmin })
    .from(AS)
    .innerJoin(schema.member, eq(schema.member.id, AS.memberId))
    .where(eq(AS.activityId, id));
  const scope = await assignmentScope(c);
  if (scope) {
    const visible = await c.db.select({ id: AS.id }).from(AS).where(and(eq(AS.activityId, id), scope));
    if (!visible.length) throw new HttpError(403, "No tienes acceso a esta actividad.");
  }
  const [project] = a.projectId ? await c.db.select().from(schema.project).where(eq(schema.project.id, a.projectId)) : [null];
  const checklist = await c.db.select().from(schema.checklistItem).where(eq(schema.checklistItem.activityId, id)).orderBy(asc(schema.checklistItem.order));
  const deps = await c.db
    .select({ id: A.id, title: A.title })
    .from(schema.activityDependency)
    .innerJoin(A, eq(A.id, schema.activityDependency.dependsOnId))
    .where(eq(schema.activityDependency.activityId, id));
  const blocks = await c.db
    .select({ id: A.id, title: A.title })
    .from(schema.activityDependency)
    .innerJoin(A, eq(A.id, schema.activityDependency.activityId))
    .where(eq(schema.activityDependency.dependsOnId, id));
  const assignmentIds = assignments.map((x) => x.a.id);
  const time = assignmentIds.length
    ? await c.db
        .select({ t: schema.timeEntry, memberName: schema.member.fullName })
        .from(schema.timeEntry)
        .innerJoin(AS, eq(AS.id, schema.timeEntry.assignmentId))
        .innerJoin(schema.member, eq(schema.member.id, AS.memberId))
        .where(inArray(schema.timeEntry.assignmentId, assignmentIds))
        .orderBy(desc(schema.timeEntry.startedAt))
    : [];
  const comments = await c.db
    .select({ c: schema.comment, author: schema.member.fullName })
    .from(schema.comment)
    .leftJoin(schema.appUser, eq(schema.appUser.id, schema.comment.authorUserId))
    .leftJoin(schema.member, eq(schema.member.id, schema.appUser.memberId))
    .where(and(eq(schema.comment.entityType, "activity"), eq(schema.comment.entityId, id)))
    .orderBy(asc(schema.comment.createdAt));
  const history = await c.db
    .select()
    .from(schema.auditLog)
    .where(or(eq(schema.auditLog.entityId, id), assignmentIds.length ? inArray(schema.auditLog.entityId, assignmentIds) : undefined))
    .orderBy(desc(schema.auditLog.at))
    .limit(200);
  const evidence = await c.db
    .select()
    .from(schema.evidence)
    .where(and(eq(schema.evidence.activityId, id), isNull(schema.evidence.deletedAt)))
    .orderBy(desc(schema.evidence.createdAt));
  const subtasks = await c.db.select({ id: A.id, title: A.title }).from(A).where(and(eq(A.parentId, id), isNull(A.deletedAt)));
  return { activity: { ...a, estimatedH: num(a.estimatedH) }, project, assignments, checklist, deps, blocks, time, comments, history, evidence, subtasks };
}

async function assertNoCycle(c: Ctx, activityId: string, dependsOn: string[]) {
  // BFS desde cada dependencia: si se llega a la actividad, habría ciclo.
  const seen = new Set<string>();
  let frontier = [...dependsOn];
  while (frontier.length) {
    if (frontier.includes(activityId)) throw new HttpError(422, "Esa dependencia crearía un ciclo.");
    frontier.forEach((f) => seen.add(f));
    const next = await c.db
      .select({ id: schema.activityDependency.dependsOnId })
      .from(schema.activityDependency)
      .where(inArray(schema.activityDependency.activityId, frontier));
    frontier = next.map((n) => n.id).filter((x) => !seen.has(x));
  }
}

/** Crea la actividad y una asignación por responsable, en una sola transacción auditada. */
export async function createActivity(c: Ctx, input: ActivityInput) {
  // Una actividad personal siempre es de la cuenta que la crea: se asigna antes de validar.
  if (input.origin === "personal") {
    if (!c.session.memberId) throw new HttpError(422, "Tu usuario no tiene ficha de persona.");
    input = { ...input, memberIds: [c.session.memberId] };
  }
  const data = activityInput.parse(input);
  if (data.origin !== "personal") {
    if (c.scope === "own") throw new HttpError(403, "No puedes asignar actividades a otras personas.");
    for (const m of data.memberIds) await assertMemberVisible(c, m);
  }
  return c.db.transaction(async (tx) => {
    const [a] = await tx
      .insert(A)
      .values({
        title: data.title,
        description: data.description ?? null,
        origin: data.origin,
        projectId: data.projectId ?? null,
        phaseId: data.phaseId ?? null,
        parentId: data.parentId ?? null,
        routineId: data.routineId ?? null,
        priority: data.priority,
        complexity: data.complexity,
        estimatedH: toNumStr(data.estimatedH),
        startDate: data.startDate ?? null,
        dueDate: data.dueDate ?? null,
        plannedStart: data.plannedStart ?? null,
        plannedEnd: data.plannedEnd ?? null,
        evidenceRequired: data.evidenceRequired,
        instructions: data.instructions ?? null,
        createdBy: c.session.userId,
      })
      .returning();
    await tx.insert(AS).values([...new Set(data.memberIds)].map((memberId) => ({ activityId: a.id, memberId })));
    if (data.dependsOn.length) {
      await tx.insert(schema.activityDependency).values(data.dependsOn.map((d) => ({ activityId: a.id, dependsOnId: d })));
    }
    if (data.checklist.length) {
      await tx.insert(schema.checklistItem).values(data.checklist.map((text, i) => ({ activityId: a.id, text, order: i })));
    }
    if (a.projectId) {
      for (const m of data.memberIds)
        await tx.insert(schema.projectMember).values({ projectId: a.projectId, memberId: m }).onConflictDoNothing();
    }
    await audit(tx, { userId: c.session.userId, entityType: "activity", entityId: a.id, action: "create", after: a });
    if (data.origin !== "personal")
      await audit(tx, { userId: c.session.userId, entityType: "activity", entityId: a.id, action: "assign", after: { memberIds: data.memberIds } });
    return a;
  });
}

const EDITABLE = ["title", "description", "origin", "projectId", "phaseId", "priority", "complexity", "estimatedH", "startDate", "dueDate", "evidenceRequired", "instructions", "plannedStart", "plannedEnd"] as const;

/** Edita campos de la actividad; cada cambio queda en el historial (reprogramar = cambio de fechas). */
export async function updateActivity(c: Ctx, id: string, patch: Partial<ActivityInput>) {
  if (c.scope === "own") throw new HttpError(403, "Solo puedes actualizar el avance de tus actividades.");
  const current = await getActivity(c, id);
  const merged = activityInput.parse({
    ...current.activity,
    description: current.activity.description,
    memberIds: current.assignments.map((x) => x.a.memberId),
    ...patch,
  });
  const set: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    const next = k === "estimatedH" ? toNumStr(merged.estimatedH) : (merged as Record<string, unknown>)[k] ?? null;
    const prev = k === "estimatedH" ? toNumStr(current.activity.estimatedH) : (current.activity as Record<string, unknown>)[k] ?? null;
    if (String(prev ?? "") !== String(next ?? "")) {
      set[k] = next;
      before[k] = prev;
    }
  }
  const memberChange = patch.memberIds ? [...new Set(patch.memberIds)] : null;
  if (patch.dependsOn) await assertNoCycle(c, id, patch.dependsOn); // fuera de la transacción (PGlite usa una sola conexión)
  return c.db.transaction(async (tx) => {
    if (Object.keys(set).length) {
      await tx.update(A).set({ ...set, updatedAt: new Date() }).where(eq(A.id, id));
      const action = "dueDate" in set || "startDate" in set ? ("priority" in set ? "update" : "reschedule") : "priority" in set ? "priority" : "update";
      await audit(tx, { userId: c.session.userId, entityType: "activity", entityId: id, action, before, after: set });
    }
    if (memberChange) {
      const existing = current.assignments.map((x) => x.a.memberId);
      const add = memberChange.filter((m) => !existing.includes(m));
      const remove = current.assignments.filter((x) => !memberChange.includes(x.a.memberId) && x.a.status !== "completada");
      for (const m of add) await tx.insert(AS).values({ activityId: id, memberId: m });
      for (const r of remove) await tx.delete(AS).where(eq(AS.id, r.a.id));
      if (add.length || remove.length)
        await audit(tx, { userId: c.session.userId, entityType: "activity", entityId: id, action: "reassign", before: { memberIds: existing }, after: { memberIds: memberChange } });
    }
    if (patch.dependsOn) {
      await tx.delete(schema.activityDependency).where(eq(schema.activityDependency.activityId, id));
      if (patch.dependsOn.length)
        await tx.insert(schema.activityDependency).values(patch.dependsOn.map((d) => ({ activityId: id, dependsOnId: d })));
    }
  });
}

/** Cambia estado/avance de una persona. Fija inicio real al empezar y fin real al completar. */
export async function setAssignmentStatus(c: Ctx, assignmentId: string, status: string, progressPct?: number | null) {
  const st = zStatus.parse(status);
  const [cur] = await c.db.select().from(AS).where(eq(AS.id, assignmentId));
  if (!cur) throw new HttpError(404, "Asignación no encontrada.");
  await assertMemberVisible(c, cur.memberId);
  const [act] = await c.db.select().from(A).where(eq(A.id, cur.activityId));
  if (st === "en_proceso" || st === "completada") {
    const pendingDeps = await c.db
      .select({ title: A.title })
      .from(schema.activityDependency)
      .innerJoin(A, eq(A.id, schema.activityDependency.dependsOnId))
      .innerJoin(AS, eq(AS.activityId, A.id))
      .where(and(eq(schema.activityDependency.activityId, act.id), sql`${AS.status} not in ('completada','cancelada')`));
    if (pendingDeps.length && cur.status === "pendiente")
      throw new HttpError(422, `Primero debe terminarse: ${[...new Set(pendingDeps.map((d) => d.title))].join(", ")}.`);
  }
  const now = new Date();
  const progress =
    st === "completada" ? 100 : progressPct != null ? Math.max(0, Math.min(99, Math.round(progressPct))) : cur.status === "completada" ? 90 : cur.progressPct;
  const next = {
    status: st,
    progressPct: progress,
    startedAt: cur.startedAt ?? (["en_proceso", "en_revision", "completada"].includes(st) ? now : null),
    finishedAt: st === "completada" ? (cur.finishedAt ?? now) : null,
    updatedAt: now,
  };
  await c.db.transaction(async (tx) => {
    await tx.update(AS).set(next).where(eq(AS.id, assignmentId));
    const action = st === "completada" ? "finish" : st === "en_proceso" && cur.status === "pendiente" ? "start" : "status";
    await audit(tx, {
      userId: c.session.userId,
      entityType: "assignment",
      entityId: assignmentId,
      action,
      before: { status: cur.status, progressPct: cur.progressPct },
      after: { status: st, progressPct: progress, activityId: cur.activityId, memberId: cur.memberId },
    });
  });
}

export async function addTimeEntry(c: Ctx, assignmentId: string, minutes: number, note: string | null, day?: string | null) {
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) throw new HttpError(422, "Minutos no válidos (1 a 1440).");
  const [cur] = await c.db.select().from(AS).where(eq(AS.id, assignmentId));
  if (!cur) throw new HttpError(404, "Asignación no encontrada.");
  await assertMemberVisible(c, cur.memberId);
  const startedAt = day ? new Date(`${day}T12:00:00Z`) : new Date();
  await c.db.transaction(async (tx) => {
    const [t] = await tx
      .insert(schema.timeEntry)
      .values({ assignmentId, minutes: Math.round(minutes), note, startedAt, createdBy: c.session.userId })
      .returning();
    const [{ total }] = await tx
      .select({ total: sql<number>`coalesce(sum(${schema.timeEntry.minutes}),0)` })
      .from(schema.timeEntry)
      .where(eq(schema.timeEntry.assignmentId, assignmentId));
    await tx.update(AS).set({ actualH: String(Math.round((Number(total) / 60) * 100) / 100), startedAt: cur.startedAt ?? startedAt }).where(eq(AS.id, assignmentId));
    await audit(tx, { userId: c.session.userId, entityType: "assignment", entityId: assignmentId, action: "time", after: { minutes: t.minutes, note } });
  });
}

export async function addChecklistItem(c: Ctx, activityId: string, text: string) {
  if (!text.trim()) throw new HttpError(422, "Escribe el paso.");
  await getActivity(c, activityId);
  const [{ n }] = await c.db.select({ n: sql<number>`count(*)` }).from(schema.checklistItem).where(eq(schema.checklistItem.activityId, activityId));
  await c.db.transaction(async (tx) => {
    const [i] = await tx.insert(schema.checklistItem).values({ activityId, text: text.trim().slice(0, 300), order: Number(n) }).returning();
    await audit(tx, { userId: c.session.userId, entityType: "activity", entityId: activityId, action: "checklist_add", after: { text: i.text } });
  });
}

export async function toggleChecklistItem(c: Ctx, itemId: string) {
  const [i] = await c.db.select().from(schema.checklistItem).where(eq(schema.checklistItem.id, itemId));
  if (!i) throw new HttpError(404, "Paso no encontrado.");
  await getActivity(c, i.activityId);
  await c.db.transaction(async (tx) => {
    await tx.update(schema.checklistItem).set({ done: !i.done, doneAt: i.done ? null : new Date() }).where(eq(schema.checklistItem.id, itemId));
    await audit(tx, { userId: c.session.userId, entityType: "activity", entityId: i.activityId, action: i.done ? "checklist_undo" : "checklist_done", after: { text: i.text } });
  });
}

export async function deleteChecklistItem(c: Ctx, itemId: string) {
  const [i] = await c.db.select().from(schema.checklistItem).where(eq(schema.checklistItem.id, itemId));
  if (!i) return;
  await getActivity(c, i.activityId);
  await c.db.transaction(async (tx) => {
    await tx.delete(schema.checklistItem).where(eq(schema.checklistItem.id, itemId));
    await audit(tx, { userId: c.session.userId, entityType: "activity", entityId: i.activityId, action: "checklist_remove", before: { text: i.text } });
  });
}

export async function addComment(c: Ctx, entityType: "activity" | "project", entityId: string, body: string) {
  const text = body.trim();
  if (!text) throw new HttpError(422, "El comentario está vacío.");
  if (entityType === "activity") await getActivity(c, entityId);
  await c.db.transaction(async (tx) => {
    await tx.insert(schema.comment).values({ entityType, entityId, body: text.slice(0, 5000), authorUserId: c.session.userId });
    await audit(tx, { userId: c.session.userId, entityType, entityId, action: "comment", after: { body: text.slice(0, 200) } });
  });
}

/** Cancela para todas las personas (queda en historial; no cuenta en cumplimiento). */
export async function cancelActivity(c: Ctx, id: string) {
  if (c.scope === "own") throw new HttpError(403, "No puedes cancelar actividades.");
  await getActivity(c, id);
  await c.db.transaction(async (tx) => {
    await tx.update(AS).set({ status: "cancelada", updatedAt: new Date() }).where(and(eq(AS.activityId, id), sql`${AS.status} <> 'completada'`));
    await audit(tx, { userId: c.session.userId, entityType: "activity", entityId: id, action: "cancel" });
  });
}

/** Borrado lógico: la actividad desaparece de listas e indicadores, pero el historial se conserva. */
export async function deleteActivity(c: Ctx, id: string) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador puede eliminar.");
  const cur = await getActivity(c, id);
  await c.db.transaction(async (tx) => {
    await tx.update(A).set({ deletedAt: new Date() }).where(eq(A.id, id));
    await audit(tx, { userId: c.session.userId, entityType: "activity", entityId: id, action: "delete", before: { title: cur.activity.title } });
  });
}

/** Mueve varias actividades a nuevas fechas (usada por la reprogramación y por la IA tras aprobación). */
export async function rescheduleMany(c: Ctx, items: { activityId: string; startDate?: string | null; dueDate: string }[]) {
  for (const it of items) await updateActivity(c, it.activityId, { dueDate: it.dueDate, ...(it.startDate !== undefined ? { startDate: it.startDate } : {}) });
}

export async function activityOptions(c: Ctx, projectId?: string | null) {
  return c.db
    .select({ id: A.id, title: A.title, projectId: A.projectId })
    .from(A)
    .where(and(isNull(A.deletedAt), projectId ? eq(A.projectId, projectId) : undefined))
    .orderBy(desc(A.createdAt))
    .limit(300);
}
