/**
 * Motor de indicadores: funciones puras, sin acceso a base de datos, para poder probarlas.
 * Regla: si no hay suficientes datos reales, el resultado es `null` y la interfaz muestra
 * «Información insuficiente». Nunca se rellenan valores ficticios.
 */
import type { Settings } from "./settings";

export type Priority = "baja" | "media" | "alta" | "critica";
export type Status = "pendiente" | "en_proceso" | "en_espera" | "bloqueada" | "en_revision" | "completada" | "cancelada";
export type Origin = "personal" | "habitual" | "extraordinaria";

export type WorkItem = {
  origin: Origin;
  priority: Priority;
  complexity: number;
  estimatedH: number | null;
  actualH: number | null;
  dueDate: string | null; // YYYY-MM-DD
  status: Status;
  finishedAt: Date | null;
  progressPct: number;
};

type Factors = Pick<Settings, "priority_factor" | "complexity_factor" | "min_sample" | "efficiency_cap">;

/** Horas usadas cuando una actividad no tiene estimación (se señala aparte en la interfaz). */
export const DEFAULT_ESTIMATE_H = 1;

export const DONE: Status[] = ["completada"];
export const CLOSED: Status[] = ["completada", "cancelada"];

export function weight(item: Pick<WorkItem, "estimatedH" | "priority" | "complexity">, f: Factors): number {
  const h = item.estimatedH && item.estimatedH > 0 ? item.estimatedH : DEFAULT_ESTIMATE_H;
  const c = Math.min(5, Math.max(1, Math.round(item.complexity || 1)));
  const pf = f.priority_factor[item.priority] ?? 1;
  const cf = (f.complexity_factor as Record<string, number>)[String(c)] ?? 1;
  return h * pf * cf;
}

/** «Vencida» no se guarda: se deriva para que nunca quede desactualizada. */
export function isOverdue(item: Pick<WorkItem, "dueDate" | "status">, today: string): boolean {
  return !!item.dueDate && !CLOSED.includes(item.status) && item.dueDate < today;
}

export function isDueSoon(item: Pick<WorkItem, "dueDate" | "status">, today: string, days: number): boolean {
  if (!item.dueDate || CLOSED.includes(item.status) || item.dueDate < today) return false;
  return item.dueDate <= addDays(today, days);
}

export function finishedOnTime(item: Pick<WorkItem, "dueDate" | "finishedAt">, tz: string): boolean | null {
  if (!item.finishedAt) return null;
  if (!item.dueDate) return true;
  return dateInTz(item.finishedAt, tz) <= item.dueDate;
}

/** Conclusión ponderada por esfuerzo (canceladas fuera). */
export function weightedCompletion(items: WorkItem[], f: Factors): number | null {
  const live = items.filter((i) => i.status !== "cancelada");
  if (live.length === 0) return null;
  const total = live.reduce((s, i) => s + weight(i, f), 0);
  const done = live.filter((i) => i.status === "completada").reduce((s, i) => s + weight(i, f), 0);
  return round1((done / total) * 100);
}

/** Avance ponderado que también reconoce el % parcial de las actividades en curso. */
export function weightedProgress(items: WorkItem[], f: Factors): number | null {
  const live = items.filter((i) => i.status !== "cancelada");
  if (live.length === 0) return null;
  const total = live.reduce((s, i) => s + weight(i, f), 0);
  const got = live.reduce((s, i) => s + weight(i, f) * (i.status === "completada" ? 1 : clamp(i.progressPct, 0, 100) / 100), 0);
  return round1((got / total) * 100);
}

export function onTimeRate(items: WorkItem[], f: Factors, tz: string): number | null {
  const done = items.filter((i) => i.status === "completada" && i.finishedAt);
  if (done.length < f.min_sample) return null;
  const ok = done.filter((i) => finishedOnTime(i, tz)).length;
  return round1((ok / done.length) * 100);
}

/** Σ estimado ÷ Σ real de completadas con horas registradas, con tope para no distorsionar. */
export function timeEfficiency(items: WorkItem[], f: Factors): number | null {
  const done = items.filter((i) => i.status === "completada" && (i.actualH ?? 0) > 0 && (i.estimatedH ?? 0) > 0);
  if (done.length < f.min_sample) return null;
  const est = done.reduce((s, i) => s + (i.estimatedH ?? 0), 0);
  const real = done.reduce((s, i) => s + (i.actualH ?? 0), 0);
  return round1(Math.min(f.efficiency_cap, (est / real) * 100));
}

export function averageHours(items: WorkItem[], f: Factors): number | null {
  const done = items.filter((i) => i.status === "completada" && (i.actualH ?? 0) > 0);
  if (done.length < f.min_sample) return null;
  return round1(done.reduce((s, i) => s + (i.actualH ?? 0), 0) / done.length);
}

/** Horas estimadas que faltan (estimado × (1 − avance)). */
export function remainingHours(items: WorkItem[]): number {
  return round1(
    items
      .filter((i) => !CLOSED.includes(i.status))
      .reduce((s, i) => s + (i.estimatedH ?? DEFAULT_ESTIMATE_H) * (1 - clamp(i.progressPct, 0, 100) / 100), 0),
  );
}

export type LoadLevel = "baja" | "normal" | "alta" | "sobrecarga";

export function loadLevel(pendingH: number, availableH: number, t: Settings["workload_thresholds"]): LoadLevel | null {
  if (availableH <= 0) return pendingH > 0 ? "sobrecarga" : null;
  const r = pendingH / availableH;
  if (r > t.sobrecarga) return "sobrecarga";
  if (r > t.alta) return "alta";
  if (r >= t.normal) return "normal";
  return "baja";
}

// ── utilidades de fecha (zona horaria de la planta) ──────────────────────────
export function dateInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function todayIn(tz: string): string {
  return dateInTz(new Date(), tz);
}
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
