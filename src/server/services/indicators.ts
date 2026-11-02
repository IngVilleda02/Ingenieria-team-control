/**
 * Indicadores por persona, por origen (habitual vs extraordinaria) y por proyecto.
 * Las comparativas siempre traen volumen ponderado y complejidad media junto al porcentaje,
 * para que nunca se lea un % sin su contexto.
 */
import type { Ctx } from "../context";
import { listAssignments, type AssignmentRow } from "./activities";
import {
  addDays, averageHours, CLOSED, dateInTz, onTimeRate, remainingHours, timeEfficiency, todayIn, weight,
  weightedCompletion, weightedProgress, type WorkItem,
} from "./metrics";
import { getSettings, type Settings } from "./settings";
import { schema } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { memberWorkload } from "./workload";

export type Block = ReturnType<typeof block>;

function block(items: WorkItem[], s: Settings, today: string) {
  const live = items.filter((i) => i.status !== "cancelada");
  const done = live.filter((i) => i.status === "completada");
  return {
    total: live.length,
    completed: done.length,
    pending: live.filter((i) => !CLOSED.includes(i.status)).length,
    overdue: live.filter((i) => i.dueDate && i.dueDate < today && !CLOSED.includes(i.status)).length,
    completion: weightedCompletion(live, s),
    onTime: onTimeRate(live, s, s.timezone),
    efficiency: timeEfficiency(live, s),
    avgHours: averageHours(live, s),
    weightedVolume: round1(live.reduce((t, i) => t + weight(i, s), 0)),
    weightedDone: round1(done.reduce((t, i) => t + weight(i, s), 0)),
    estimatedH: round1(live.reduce((t, i) => t + (i.estimatedH ?? 0), 0)),
    actualH: round1(live.reduce((t, i) => t + (i.actualH ?? 0), 0)),
    avgComplexity: live.length ? round1(live.reduce((t, i) => t + i.complexity, 0) / live.length) : null,
    remainingH: remainingHours(live),
  };
}

function inPeriod(i: AssignmentRow, from?: string | null, to?: string | null) {
  const ref = i.dueDate ?? i.startDate ?? i.assignedAt.toISOString().slice(0, 10);
  return (!from || ref >= from) && (!to || ref <= to);
}

/** Serie semanal (8) y mensual (6) de esfuerzo completado, separando habitual y extraordinaria. */
function series(items: AssignmentRow[], s: Settings, today: string) {
  const monday = (d: string) => {
    const dt = new Date(`${d}T12:00:00Z`);
    const wd = (dt.getUTCDay() + 6) % 7;
    return addDays(d, -wd);
  };
  const thisWeek = monday(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, (i - 7) * 7));
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });
  const done = items.filter((i) => i.status === "completada" && i.finishedAt);
  const sum = (arr: AssignmentRow[]) => round1(arr.reduce((t, i) => t + weight(i, s), 0));
  return {
    weekly: weeks.map((w) => {
      const inW = done.filter((i) => {
        const d = dateInTz(i.finishedAt!, s.timezone);
        return d >= w && d < addDays(w, 7);
      });
      return { label: w, habitual: sum(inW.filter((i) => i.origin === "habitual")), extraordinaria: sum(inW.filter((i) => i.origin === "extraordinaria")), personal: sum(inW.filter((i) => i.origin === "personal")) };
    }),
    monthly: months.map((m) => {
      const inM = done.filter((i) => dateInTz(i.finishedAt!, s.timezone).startsWith(m));
      return { label: m, habitual: sum(inM.filter((i) => i.origin === "habitual")), extraordinaria: sum(inM.filter((i) => i.origin === "extraordinaria")), personal: sum(inM.filter((i) => i.origin === "personal")) };
    }),
  };
}

export async function memberIndicators(c: Ctx, memberId: string, from?: string | null, to?: string | null) {
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const all = await listAssignments(c, { memberId });
  const items = all.filter((i) => inPeriod(i, from, to));
  return {
    all: block(items, s, today),
    habitual: block(items.filter((i) => i.origin === "habitual"), s, today),
    extraordinaria: block(items.filter((i) => i.origin === "extraordinaria"), s, today),
    personal: block(items.filter((i) => i.origin === "personal"), s, today),
    proyecto: block(items.filter((i) => i.projectId), s, today),
    series: series(all, s, today),
    items,
  };
}

export async function teamIndicators(c: Ctx, from?: string | null, to?: string | null) {
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const members = await c.db.select().from(schema.member).where(and(eq(schema.member.isActive, true)));
  const all = (await listAssignments(c)).filter((i) => inPeriod(i, from, to));
  const rows = [];
  for (const m of members.filter((m) => !m.isAdmin)) {
    const mine = all.filter((i) => i.memberId === m.id);
    rows.push({
      id: m.id,
      name: m.fullName,
      position: m.position,
      all: block(mine, s, today),
      habitual: block(mine.filter((i) => i.origin === "habitual"), s, today),
      extraordinaria: block(mine.filter((i) => i.origin === "extraordinaria"), s, today),
      workload: await memberWorkload(c, m.id),
    });
  }
  const team = all.filter((i) => !i.memberIsAdmin);
  const admin = members.find((m) => m.isAdmin);
  return {
    rows,
    team: { all: block(team, s, today), habitual: block(team.filter((i) => i.origin === "habitual"), s, today), extraordinaria: block(team.filter((i) => i.origin === "extraordinaria"), s, today) },
    personal: admin ? block(all.filter((i) => i.memberId === admin.id), s, today) : null,
    series: series(team, s, today),
    slowest: all
      .filter((i) => i.status === "completada" && (i.actualH ?? 0) > 0)
      .sort((a, b) => (b.actualH ?? 0) - (a.actualH ?? 0))
      .slice(0, 8),
    openHeaviest: all
      .filter((i) => !CLOSED.includes(i.status))
      .sort((a, b) => (b.actualH ?? 0) - (a.actualH ?? 0))
      .filter((i) => (i.actualH ?? 0) > 0)
      .slice(0, 8),
  };
}

/** Eficiencia del proyecto: avance real contra tiempo transcurrido y fecha proyectada de cierre. */
export function projectProjection(
  p: { startDate: string | null; dueDate: string | null; status: string },
  items: AssignmentRow[],
  s: Settings,
) {
  const today = todayIn(s.timezone);
  const progress = weightedProgress(items, s);
  let elapsedPct: number | null = null;
  if (p.startDate && p.dueDate && p.dueDate > p.startDate) {
    const total = daysBetween(p.startDate, p.dueDate);
    elapsedPct = round1(Math.max(0, Math.min(100, (daysBetween(p.startDate, today) / total) * 100)));
  }
  const daysLeft = p.dueDate ? daysBetween(today, p.dueDate) : null;
  const live = items.filter((i) => i.status !== "cancelada");
  const remainingW = live.filter((i) => i.status !== "completada").reduce((t, i) => t + weight(i, s) * (1 - i.progressPct / 100), 0);
  const since = addDays(today, -28);
  const recentW = live
    .filter((i) => i.status === "completada" && i.finishedAt && dateInTz(i.finishedAt, s.timezone) >= since)
    .reduce((t, i) => t + weight(i, s), 0);
  const ratePerDay = recentW / 28;
  let projectedEnd: string | null = null;
  if (remainingW === 0 && live.length) projectedEnd = today;
  else if (ratePerDay > 0) projectedEnd = addDays(today, Math.ceil(remainingW / ratePerDay));
  const variance = progress != null && elapsedPct != null ? round1(progress - elapsedPct) : null;
  const atRisk =
    !["completado", "cancelado"].includes(p.status) &&
    ((projectedEnd && p.dueDate && projectedEnd > p.dueDate) || (variance != null && variance < -15) || (daysLeft != null && daysLeft < 0));
  return {
    elapsedPct,
    daysLeft,
    variance,
    projectedEnd,
    ratePerDay: round1(ratePerDay),
    remainingWeighted: round1(remainingW),
    pendingCount: live.filter((i) => !CLOSED.includes(i.status)).length,
    overdueCount: live.filter((i) => i.overdue).length,
    onTime: onTimeRate(live, s, s.timezone),
    atRisk: !!atRisk,
    insufficient: projectedEnd == null && remainingW > 0,
  };
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
}
const round1 = (v: number) => Math.round(v * 10) / 10;
