import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

/** Valores de partida aprobados; editables en Configuración (Fase 4). */
export const DEFAULT_SETTINGS = {
  timezone: "America/Mexico_City",
  priority_factor: { baja: 0.8, media: 1.0, alta: 1.2, critica: 1.5 },
  complexity_factor: { "1": 0.8, "2": 0.95, "3": 1.1, "4": 1.25, "5": 1.4 },
  workload_thresholds: { normal: 0.5, alta: 0.85, sobrecarga: 1.0 },
  due_soon_days: 2,
  min_sample: 3,
  efficiency_cap: 200,
};

export type Settings = typeof DEFAULT_SETTINGS;

/** La configuración casi nunca cambia: se guarda 60 s en memoria para no consultar la base en cada pantalla. */
const SETTINGS_TTL_MS = 60_000;
let cached: { value: Settings; at: number } | null = null;
export function invalidateSettings() {
  cached = null;
}

export async function getSettings(): Promise<Settings> {
  if (cached && Date.now() - cached.at < SETTINGS_TTL_MS) return cached.value;
  const db = await getDb();
  const rows = await db.select().from(schema.setting);
  const out = structuredClone(DEFAULT_SETTINGS) as Record<string, unknown>;
  for (const r of rows) out[r.key] = r.value;
  cached = { value: out as Settings, at: Date.now() };
  return cached.value;
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

// ── Edición (solo administrador) ─────────────────────────────────────────────
import { z } from "zod";
import { audit } from "../audit";
import type { Ctx } from "../context";
import { HttpError } from "../errors";

const factorSchema = z.object({
  priority_factor: z.object({ baja: z.number().min(0.1).max(5), media: z.number().min(0.1).max(5), alta: z.number().min(0.1).max(5), critica: z.number().min(0.1).max(5) }),
  complexity_factor: z.object({ "1": z.number().min(0.1).max(5), "2": z.number().min(0.1).max(5), "3": z.number().min(0.1).max(5), "4": z.number().min(0.1).max(5), "5": z.number().min(0.1).max(5) }),
  workload_thresholds: z.object({ normal: z.number().min(0.05).max(3), alta: z.number().min(0.05).max(3), sobrecarga: z.number().min(0.05).max(3) }).refine((t) => t.normal < t.alta && t.alta <= t.sobrecarga, "Los umbrales deben ir de menor a mayor."),
  due_soon_days: z.number().int().min(0).max(30),
  min_sample: z.number().int().min(1).max(50),
  efficiency_cap: z.number().min(100).max(1000),
});

export async function saveSettings(c: Ctx, input: z.input<typeof factorSchema>) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador cambia la configuración.");
  const d = factorSchema.parse(input);
  const before = await getSettings();
  await c.db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(d)) {
      await tx.insert(schema.setting).values({ key, value }).onConflictDoUpdate({ target: schema.setting.key, set: { value, updatedAt: new Date() } });
    }
    await audit(tx, { userId: c.session.userId, entityType: "setting", action: "settings", before, after: d });
  });
  invalidateSettings();
}

export async function saveShiftDefinitions(c: Ctx, defs: { kind: "dia" | "noche"; startTime: string; hours: number; breakMin: number }[], workdays: number[]) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador cambia la configuración.");
  for (const d of defs) {
    if (!/^\d{2}:\d{2}$/.test(d.startTime) || d.hours <= 0 || d.hours > 24 || d.breakMin < 0 || d.breakMin > 240) throw new HttpError(422, "Revisa los horarios de turno.");
  }
  await c.db.transaction(async (tx) => {
    for (const d of defs) {
      await tx
        .insert(schema.shiftDefinition)
        .values({ kind: d.kind, startTime: d.startTime, hours: String(d.hours), breakMin: d.breakMin })
        .onConflictDoUpdate({ target: schema.shiftDefinition.kind, set: { startTime: d.startTime, hours: String(d.hours), breakMin: d.breakMin } });
    }
    for (let wd = 1; wd <= 7; wd++) {
      const existing = await tx.select().from(schema.workCalendar).where(and(isNull(schema.workCalendar.memberId), eq(schema.workCalendar.weekday, wd)));
      if (existing.length) await tx.update(schema.workCalendar).set({ isWorkday: workdays.includes(wd) }).where(eq(schema.workCalendar.id, existing[0].id));
      else await tx.insert(schema.workCalendar).values({ memberId: null, weekday: wd, isWorkday: workdays.includes(wd) });
    }
    await audit(tx, { userId: c.session.userId, entityType: "setting", action: "settings", after: { shifts: defs, workdays } });
  });
}
