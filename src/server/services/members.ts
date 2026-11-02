import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { zDate, zPriority } from "@/lib/schemas";
import { audit } from "../audit";
import { assertMemberVisible, visibleMemberIds, type Ctx } from "../context";
import { HttpError } from "../errors";
import { createActivity } from "./activities";
import { addDays, todayIn } from "./metrics";
import { getSetting } from "./settings";
import { mondayOf } from "./workload";

const M = schema.member;

export const memberInput = z.object({
  fullName: z.string().min(3, "Escribe el nombre completo.").max(120),
  internalCode: z.string().max(40).nullable().optional(),
  position: z.string().max(120).nullable().optional(),
  area: z.string().max(120).nullable().optional(),
  specialty: z.string().max(160).nullable().optional(),
  responsibilities: z.string().max(5000).nullable().optional(),
  joinedAt: zDate.optional(),
  isActive: z.boolean().default(true),
  supervisorId: z.string().uuid().nullable().optional(),
});

export async function listMembers(c: Ctx, opts: { includeAdmin?: boolean; includeInactive?: boolean } = {}) {
  const ids = await visibleMemberIds(c);
  const rows = await c.db
    .select()
    .from(M)
    .where(and(opts.includeInactive ? undefined : eq(M.isActive, true), opts.includeAdmin ? undefined : eq(M.isAdmin, false), ids ? inArray(M.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]) : undefined))
    .orderBy(desc(M.isAdmin), asc(M.fullName));
  return rows;
}

export async function memberOptions(c: Ctx) {
  return (await listMembers(c, { includeAdmin: true })).map((m) => ({ id: m.id, name: m.fullName, isAdmin: m.isAdmin }));
}

export async function getMember(c: Ctx, id: string) {
  await assertMemberVisible(c, id);
  const [m] = await c.db.select().from(M).where(eq(M.id, id));
  if (!m) throw new HttpError(404, "Persona no encontrada.");
  const routines = await c.db.select().from(schema.routineTemplate).where(eq(schema.routineTemplate.memberId, id)).orderBy(asc(schema.routineTemplate.title));
  const shifts = await c.db.select().from(schema.shiftAssignment).where(eq(schema.shiftAssignment.memberId, id)).orderBy(desc(schema.shiftAssignment.weekStart)).limit(12);
  const timeOff = await c.db.select().from(schema.timeOff).where(eq(schema.timeOff.memberId, id)).orderBy(desc(schema.timeOff.dateFrom)).limit(20);
  const projects = await c.db
    .select({ id: schema.project.id, name: schema.project.name, status: schema.project.status })
    .from(schema.projectMember)
    .innerJoin(schema.project, eq(schema.project.id, schema.projectMember.projectId))
    .where(and(eq(schema.projectMember.memberId, id), isNull(schema.project.deletedAt)));
  const evidence = await c.db.select().from(schema.evidence).where(and(eq(schema.evidence.memberId, id), isNull(schema.evidence.deletedAt))).orderBy(desc(schema.evidence.createdAt)).limit(50);
  return { member: m, routines, shifts, timeOff, projects, evidence };
}

export async function createMember(c: Ctx, input: z.input<typeof memberInput>) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador registra personas.");
  const d = memberInput.parse(input);
  return c.db.transaction(async (tx) => {
    const [m] = await tx
      .insert(M)
      .values({ ...d, internalCode: d.internalCode || null, joinedAt: d.joinedAt ?? undefined, createdBy: c.session.userId, supervisorId: d.supervisorId ?? c.session.memberId })
      .returning();
    await audit(tx, { userId: c.session.userId, entityType: "member", entityId: m.id, action: "create", after: m });
    return m;
  });
}

export async function updateMember(c: Ctx, id: string, input: z.input<typeof memberInput>) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador edita fichas.");
  const d = memberInput.parse(input);
  const [cur] = await c.db.select().from(M).where(eq(M.id, id));
  if (!cur) throw new HttpError(404, "Persona no encontrada.");
  if (cur.isAdmin && !d.isActive) throw new HttpError(422, "No puedes desactivar al administrador.");
  await c.db.transaction(async (tx) => {
    await tx.update(M).set({ ...d, internalCode: d.internalCode || null, updatedAt: new Date() }).where(eq(M.id, id));
    await audit(tx, { userId: c.session.userId, entityType: "member", entityId: id, action: "update", before: cur, after: d });
  });
}

// ── Actividades habituales recurrentes ───────────────────────────────────────
export const routineInput = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).nullable().optional(),
  frequency: z.enum(["diaria", "semanal", "mensual"]),
  weekday: z.number().int().min(1).max(7).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  estimatedH: z.number().min(0.1).max(24),
  priority: zPriority.default("media"),
  complexity: z.number().int().min(1).max(5).default(2),
});

export async function addRoutine(c: Ctx, memberId: string, input: z.input<typeof routineInput>) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador define actividades habituales.");
  const d = routineInput.parse(input);
  if (d.frequency === "semanal" && !d.weekday) throw new HttpError(422, "Elige el día de la semana.");
  if (d.frequency === "mensual" && !d.dayOfMonth) throw new HttpError(422, "Elige el día del mes.");
  return c.db.transaction(async (tx) => {
    const [r] = await tx.insert(schema.routineTemplate).values({ ...d, memberId, estimatedH: String(d.estimatedH) }).returning();
    await audit(tx, { userId: c.session.userId, entityType: "member", entityId: memberId, action: "routine_add", after: r });
    return r;
  });
}

export async function toggleRoutine(c: Ctx, routineId: string) {
  if (c.scope !== "all") throw new HttpError(403, "Sin permiso.");
  const [r] = await c.db.select().from(schema.routineTemplate).where(eq(schema.routineTemplate.id, routineId));
  if (!r) throw new HttpError(404, "No encontrada.");
  await c.db.transaction(async (tx) => {
    await tx.update(schema.routineTemplate).set({ isActive: !r.isActive }).where(eq(schema.routineTemplate.id, routineId));
    await audit(tx, { userId: c.session.userId, entityType: "member", entityId: r.memberId, action: r.isActive ? "routine_pause" : "routine_resume", after: { title: r.title } });
  });
}

/**
 * Genera las instancias reales de las actividades habituales en el periodo (idempotente).
 * Cada instancia es una actividad normal: se mide con su estado y tiempo real, no con la plantilla.
 */
export async function generateRoutineInstances(c: Ctx, from: string, to: string) {
  if (c.scope !== "all") throw new HttpError(403, "Sin permiso.");
  const routines = await c.db
    .select({ r: schema.routineTemplate, active: M.isActive })
    .from(schema.routineTemplate)
    .innerJoin(M, eq(M.id, schema.routineTemplate.memberId))
    .where(eq(schema.routineTemplate.isActive, true));
  let created = 0;
  for (const { r, active } of routines) {
    if (!active) continue;
    const existing = await c.db
      .select({ due: schema.activity.dueDate })
      .from(schema.activity)
      .where(and(eq(schema.activity.routineId, r.id), gte(schema.activity.dueDate, from), lte(schema.activity.dueDate, to), isNull(schema.activity.deletedAt)));
    const have = new Set(existing.map((e) => e.due));
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const dt = new Date(`${d}T12:00:00Z`);
      const wd = ((dt.getUTCDay() + 6) % 7) + 1;
      const hit = r.frequency === "diaria" ? wd <= 5 : r.frequency === "semanal" ? wd === r.weekday : dt.getUTCDate() === r.dayOfMonth;
      if (!hit || have.has(d)) continue;
      await createActivity(c, {
        title: r.title,
        description: r.description,
        origin: "habitual",
        routineId: r.id,
        priority: r.priority,
        complexity: r.complexity,
        estimatedH: Number(r.estimatedH),
        startDate: d,
        dueDate: d,
        memberIds: [r.memberId],
      });
      created++;
    }
  }
  return created;
}

/** Genera la semana actual y la siguiente si faltan (se llama al abrir Mi equipo/Asignaciones). */
const ROUTINES_EVERY_MS = 6 * 3600_000;
const routineState = globalThis as unknown as { __itcRoutinesAt?: number };
export async function ensureRoutinesGenerated(c: Ctx, force = false) {
  if (c.scope !== "all") return 0;
  if (!force && routineState.__itcRoutinesAt && Date.now() - routineState.__itcRoutinesAt < ROUTINES_EVERY_MS) return 0;
  routineState.__itcRoutinesAt = Date.now();
  const today = todayIn(await getSetting("timezone"));
  return generateRoutineInstances(c, today, addDays(mondayOf(today), 13));
}

// ── Turnos y ausencias ───────────────────────────────────────────────────────
export async function setShift(c: Ctx, memberId: string, weekStart: string, kind: "dia" | "noche" | "descanso") {
  if (c.scope !== "all") throw new HttpError(403, "Sin permiso.");
  const ws = mondayOf(zDate.parse(weekStart));
  await c.db.transaction(async (tx) => {
    await tx
      .insert(schema.shiftAssignment)
      .values({ memberId, weekStart: ws, kind })
      .onConflictDoUpdate({ target: [schema.shiftAssignment.memberId, schema.shiftAssignment.weekStart], set: { kind } });
    await audit(tx, { userId: c.session.userId, entityType: "member", entityId: memberId, action: "shift", after: { weekStart: ws, kind } });
  });
}

/** Rotación semanal: asigna turnos alternos día/noche para N semanas a partir de la indicada. */
export async function rotateShifts(c: Ctx, memberId: string, weekStart: string, first: "dia" | "noche", weeks: number) {
  let kind = first;
  for (let i = 0; i < Math.min(Math.max(weeks, 1), 26); i++) {
    await setShift(c, memberId, addDays(mondayOf(weekStart), i * 7), kind);
    kind = kind === "dia" ? "noche" : "dia";
  }
}

export async function addTimeOff(c: Ctx, memberId: string, dateFrom: string, dateTo: string, reason: string | null) {
  if (c.scope !== "all") throw new HttpError(403, "Sin permiso.");
  if (zDate.parse(dateTo) < zDate.parse(dateFrom)) throw new HttpError(422, "La fecha final es anterior a la inicial.");
  await c.db.transaction(async (tx) => {
    await tx.insert(schema.timeOff).values({ memberId, dateFrom, dateTo, reason });
    await audit(tx, { userId: c.session.userId, entityType: "member", entityId: memberId, action: "time_off", after: { dateFrom, dateTo, reason } });
  });
}

export async function shiftBoard(c: Ctx, weeks = 6) {
  const today = todayIn(await getSetting("timezone"));
  const start = mondayOf(today);
  const cols = Array.from({ length: weeks }, (_, i) => addDays(start, i * 7));
  const members = await listMembers(c);
  const rows = await c.db
    .select()
    .from(schema.shiftAssignment)
    .where(and(gte(schema.shiftAssignment.weekStart, cols[0]), lte(schema.shiftAssignment.weekStart, cols.at(-1)!)));
  return { cols, members: members.map((m) => ({ id: m.id, name: m.fullName, shifts: cols.map((w) => rows.find((r) => r.memberId === m.id && r.weekStart === w)?.kind ?? null) })) };
}

export async function countMembers(c: Ctx) {
  const [{ n }] = await c.db.select({ n: sql<number>`count(*)` }).from(M).where(and(eq(M.isAdmin, false), eq(M.isActive, true)));
  return Number(n);
}
