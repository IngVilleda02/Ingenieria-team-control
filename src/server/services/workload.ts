/**
 * Carga de trabajo. Disponibilidad = días laborables × horas del turno de esa semana − descanso,
 * descontando ausencias. Nunca se supone que todo el día está disponible.
 */
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { schema } from "@/db/client";
import type { Ctx } from "../context";
import { listAssignments } from "./activities";
import { addDays, CLOSED, DEFAULT_ESTIMATE_H, loadLevel, todayIn, type LoadLevel } from "./metrics";
import { getSettings } from "./settings";

export const WINDOW_WORKDAYS = 5;

export function mondayOf(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
}
const weekday = (iso: string) => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = lunes

export async function capacityByDay(c: Ctx, memberId: string, from: string, to: string) {
  const defs = await c.db.select().from(schema.shiftDefinition);
  const def = new Map(defs.map((d) => [d.kind, { hours: Number(d.hours), breakMin: d.breakMin }]));
  const cal = await c.db.select().from(schema.workCalendar).where(or(isNull(schema.workCalendar.memberId), eq(schema.workCalendar.memberId, memberId)));
  const isWork = (wd: number) => {
    const own = cal.find((r) => r.memberId === memberId && r.weekday === wd);
    const gen = cal.find((r) => r.memberId === null && r.weekday === wd);
    return (own ?? gen)?.isWorkday ?? wd <= 5;
  };
  const shifts = await c.db
    .select()
    .from(schema.shiftAssignment)
    .where(and(eq(schema.shiftAssignment.memberId, memberId), gte(schema.shiftAssignment.weekStart, mondayOf(from)), lte(schema.shiftAssignment.weekStart, to)));
  const off = await c.db
    .select()
    .from(schema.timeOff)
    .where(and(eq(schema.timeOff.memberId, memberId), lte(schema.timeOff.dateFrom, to), gte(schema.timeOff.dateTo, from)));
  const days: { date: string; hours: number; shift: string; assumed: boolean }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const sh = shifts.find((s) => s.weekStart === mondayOf(d));
    const kind = sh?.kind ?? "dia";
    const sd = def.get(kind) ?? { hours: 8, breakMin: 60 };
    const working = isWork(weekday(d)) && !off.some((o) => o.dateFrom <= d && o.dateTo >= d) && kind !== "descanso";
    days.push({ date: d, hours: working ? Math.max(0, sd.hours - sd.breakMin / 60) : 0, shift: kind, assumed: !sh });
  }
  return days;
}

/** Siguiente ventana de N días laborables a partir de hoy. */
async function workWindow(c: Ctx, memberId: string, today: string, n: number) {
  const days = await capacityByDay(c, memberId, today, addDays(today, 21));
  const out: typeof days = [];
  for (const d of days) {
    if (d.hours > 0) out.push(d);
    if (out.length >= n) break;
  }
  return { days: out, end: out.at(-1)?.date ?? addDays(today, n) };
}

export type Workload = {
  memberId: string;
  availableH: number;
  pendingH: number;
  level: LoadLevel | null;
  windowEnd: string;
  next24: { pendingH: number; availableH: number };
  pendingCount: number;
  priorityCount: number;
  extraordinaryCount: number;
  overdueCount: number;
  shiftThisWeek: string;
  shiftAssumed: boolean;
};

export async function memberWorkload(c: Ctx, memberId: string, extra?: { estimatedH: number; dueDate: string | null }): Promise<Workload> {
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const win = await workWindow(c, memberId, today, WINDOW_WORKDAYS);
  const open = (await listAssignments(c, { memberId })).filter((i) => !CLOSED.includes(i.status));
  const rem = (i: { estimatedH: number | null; progressPct: number }) => (i.estimatedH ?? DEFAULT_ESTIMATE_H) * (1 - i.progressPct / 100);
  const inWindow = open.filter((i) => !i.dueDate || i.dueDate <= win.end);
  let pendingH = inWindow.filter((i) => i.dueDate).reduce((t, i) => t + rem(i), 0);
  const tomorrow = addDays(today, 1);
  let next24P = open.filter((i) => i.dueDate && i.dueDate <= tomorrow).reduce((t, i) => t + rem(i), 0);
  if (extra) {
    if (!extra.dueDate || extra.dueDate <= win.end) pendingH += extra.estimatedH;
    if (extra.dueDate && extra.dueDate <= tomorrow) next24P += extra.estimatedH;
  }
  const availableH = win.days.reduce((t, d) => t + d.hours, 0);
  const cap24 = await capacityByDay(c, memberId, today, tomorrow);
  const thisWeek = (await capacityByDay(c, memberId, today, today))[0];
  return {
    memberId,
    availableH: round1(availableH),
    pendingH: round1(pendingH),
    level: loadLevel(pendingH, availableH, s.workload_thresholds),
    windowEnd: win.end,
    next24: { pendingH: round1(next24P), availableH: round1(cap24.reduce((t, d) => t + d.hours, 0)) },
    pendingCount: open.length,
    priorityCount: open.filter((i) => i.priority === "alta" || i.priority === "critica").length,
    extraordinaryCount: open.filter((i) => i.origin === "extraordinaria").length,
    overdueCount: open.filter((i) => i.overdue).length,
    shiftThisWeek: thisWeek.shift,
    shiftAssumed: thisWeek.assumed,
  };
}

/** Vista previa antes de asignar: carga actual y resultante, con advertencia si sube a alta o sobrecarga. */
export async function previewAssignment(c: Ctx, memberIds: string[], estimatedH: number | null, dueDate: string | null) {
  const est = estimatedH ?? DEFAULT_ESTIMATE_H;
  const out = [];
  for (const m of memberIds) {
    const [mem] = await c.db.select({ name: schema.member.fullName }).from(schema.member).where(eq(schema.member.id, m));
    const before = await memberWorkload(c, m);
    const after = await memberWorkload(c, m, { estimatedH: est, dueDate });
    const warn = after.level === "alta" || after.level === "sobrecarga" || after.next24.pendingH > after.next24.availableH;
    out.push({
      memberId: m,
      name: mem?.name ?? "—",
      before,
      after,
      warn,
      message: warn
        ? `${mem?.name ?? "Este colaborador"} tendría ${after.next24.pendingH} h estimadas pendientes para hoy y mañana, con ${after.next24.availableH} h disponibles, y su carga de los próximos ${WINDOW_WORKDAYS} días hábiles quedaría en «${LEVEL_LABEL[after.level ?? "normal"]}» (${after.pendingH} de ${after.availableH} h). ¿Deseas continuar con la asignación?`
        : null,
    });
  }
  return out;
}

export const LEVEL_LABEL: Record<LoadLevel, string> = { baja: "Carga baja", normal: "Carga normal", alta: "Carga alta", sobrecarga: "Sobrecarga" };
const round1 = (v: number) => Math.round(v * 10) / 10;
