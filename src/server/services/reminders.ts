/**
 * Recordatorios y notificaciones internas.
 * - Recordatorios manuales (personales, de proyecto o de equipo) con aviso 24 h, 3 d, 7 d o fecha propia.
 * - Alertas automáticas: actividad próxima a vencer y vencida (una sola vez por actividad y persona).
 * `syncNotifications` es idempotente: se ejecuta al abrir la app y desde el cron de Vercel.
 */
import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, type Db } from "@/db/client";
import { audit } from "../audit";
import type { Ctx } from "../context";
import { HttpError } from "../errors";
import { addDays, todayIn } from "./metrics";
import { getSettings } from "./settings";

const R = schema.reminder;
const N = schema.notification;

export const REMINDER_KINDS: Record<string, string> = {
  vencimiento: "Actividad próxima a vencer",
  vencida: "Actividad vencida",
  revision: "Revisión de proyecto",
  evidencia: "Entrega de evidencia",
  seguimiento: "Seguimiento a colaborador",
  reunion: "Reunión",
  fecha: "Fecha importante",
};
export const OFFSETS: Record<string, string> = { "0": "En la fecha", "24h": "24 horas antes", "3d": "3 días antes", "7d": "7 días antes", personalizado: "Fecha y hora personalizada" };

export const reminderInput = z.object({
  title: z.string().min(3, "Escribe el recordatorio.").max(200),
  kind: z.enum(Object.keys(REMINDER_KINDS) as [string, ...string[]]),
  scope: z.enum(["personal", "proyecto", "equipo"]),
  activityId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  memberId: z.string().uuid().nullable().optional(),
  eventAt: z.date({ message: "Fecha no válida." }),
  offsets: z.array(z.enum(["0", "24h", "3d", "7d", "personalizado"])).min(1, "Elige al menos un aviso."),
  customAt: z.date().nullable().optional(),
});

const OFFSET_MS: Record<string, number> = { "0": 0, "24h": 864e5, "3d": 3 * 864e5, "7d": 7 * 864e5 };

export async function createReminders(c: Ctx, input: z.input<typeof reminderInput>) {
  const d = reminderInput.parse(input);
  if (d.scope === "proyecto" && !d.projectId) throw new HttpError(422, "Elige el proyecto.");
  if (d.scope === "equipo" && !d.memberId) throw new HttpError(422, "Elige al colaborador.");
  const rows = d.offsets.map((o) => ({
    title: d.title,
    kind: d.kind,
    scope: d.scope,
    activityId: d.activityId ?? null,
    projectId: d.projectId ?? null,
    memberId: d.memberId ?? null,
    fireAt: o === "personalizado" ? (d.customAt ?? d.eventAt) : new Date(d.eventAt.getTime() - OFFSET_MS[o]),
    offsetLabel: o,
    createdBy: c.session.userId,
  }));
  await c.db.transaction(async (tx) => {
    const ins = await tx.insert(R).values(rows).returning();
    await audit(tx, { userId: c.session.userId, entityType: d.activityId ? "activity" : d.projectId ? "project" : "reminder", entityId: d.activityId ?? d.projectId ?? ins[0].id, action: "reminder", after: { title: d.title, offsets: d.offsets } });
  });
  await syncNotifications(c.db);
}

export async function listReminders(c: Ctx, opts: { pendingOnly?: boolean } = {}) {
  return c.db
    .select({ r: R, projectName: schema.project.name, memberName: schema.member.fullName, activityTitle: schema.activity.title })
    .from(R)
    .leftJoin(schema.project, eq(schema.project.id, R.projectId))
    .leftJoin(schema.member, eq(schema.member.id, R.memberId))
    .leftJoin(schema.activity, eq(schema.activity.id, R.activityId))
    .where(opts.pendingOnly ? isNull(R.firedAt) : undefined)
    .orderBy(asc(R.fireAt))
    .limit(300);
}

export async function deleteReminder(c: Ctx, id: string) {
  await c.db.transaction(async (tx) => {
    const [r] = await tx.delete(R).where(eq(R.id, id)).returning();
    if (r) await audit(tx, { userId: c.session.userId, entityType: "reminder", entityId: id, action: "delete", before: { title: r.title } });
  });
}

/** Genera las notificaciones que correspondan ahora. Seguro de ejecutar muchas veces. */
export async function syncNotifications(db?: Db) {
  db ??= await getDb();
  const settings = await getSettings();
  const now = new Date();
  const today = todayIn(settings.timezone);
  const admins = await db
    .select({ id: schema.appUser.id })
    .from(schema.appUser)
    .innerJoin(schema.role, eq(schema.role.id, schema.appUser.roleId))
    .where(and(eq(schema.role.code, "admin"), eq(schema.appUser.isActive, true)));
  if (!admins.length) return 0;
  let created = 0;

  // 1) Recordatorios vencidos
  const due = await db.select().from(R).where(and(isNull(R.firedAt), lte(R.fireAt, now)));
  for (const r of due) {
    for (const a of admins) {
      const res = await db
        .insert(N)
        .values({
          userId: a.id,
          scope: r.scope,
          title: r.title,
          body: `${REMINDER_KINDS[r.kind] ?? r.kind} · ${OFFSETS[r.offsetLabel ?? "0"] ?? ""}`,
          link: r.activityId ? `/actividades/${r.activityId}` : r.projectId ? `/proyectos/${r.projectId}` : r.memberId ? `/equipo/${r.memberId}` : "/recordatorios",
          reminderId: r.id,
          dedupeKey: `rem:${r.id}:${a.id}`,
        })
        .onConflictDoNothing()
        .returning();
      created += res.length;
    }
    await db.update(R).set({ firedAt: now }).where(eq(R.id, r.id));
  }

  // 2) Alertas automáticas de actividades
  const soon = addDays(today, settings.due_soon_days);
  const open = await db
    .select({
      asg: schema.activityAssignment.id,
      activityId: schema.activity.id,
      title: schema.activity.title,
      due: schema.activity.dueDate,
      who: schema.member.fullName,
      isAdmin: schema.member.isAdmin,
      projectId: schema.activity.projectId,
    })
    .from(schema.activityAssignment)
    .innerJoin(schema.activity, eq(schema.activity.id, schema.activityAssignment.activityId))
    .innerJoin(schema.member, eq(schema.member.id, schema.activityAssignment.memberId))
    .where(and(isNull(schema.activity.deletedAt), sql`${schema.activityAssignment.status} not in ('completada','cancelada')`, lte(schema.activity.dueDate, soon)));
  for (const o of open) {
    if (!o.due) continue;
    const overdue = o.due < today;
    const key = `${overdue ? "late" : "soon"}:${o.asg}:${o.due}`;
    for (const a of admins) {
      const res = await db
        .insert(N)
        .values({
          userId: a.id,
          scope: o.isAdmin ? "personal" : o.projectId ? "proyecto" : "equipo",
          title: overdue ? `Vencida: ${o.title}` : `Próxima a vencer: ${o.title}`,
          body: `${o.isAdmin ? "Tuya" : o.who} · límite ${o.due}`,
          link: `/actividades/${o.activityId}`,
          dedupeKey: `${key}:${a.id}`,
        })
        .onConflictDoNothing()
        .returning();
      created += res.length;
    }
  }
  return created;
}

export async function listNotifications(c: Ctx, limit = 50) {
  return c.db.select().from(N).where(eq(N.userId, c.session.userId)).orderBy(desc(N.createdAt)).limit(limit);
}
export async function unreadCount(c: Ctx) {
  const [{ n }] = await c.db.select({ n: sql<number>`count(*)` }).from(N).where(and(eq(N.userId, c.session.userId), isNull(N.readAt)));
  return Number(n);
}
export async function markRead(c: Ctx, ids: string[] | "all") {
  await c.db
    .update(N)
    .set({ readAt: new Date() })
    .where(and(eq(N.userId, c.session.userId), isNull(N.readAt), ids === "all" ? undefined : inArray(N.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])));
}
