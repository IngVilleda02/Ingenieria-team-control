/**
 * Respaldo y recuperación completos. Exporta todas las tablas a JSON y restaura con
 * json_populate_recordset, dejando que PostgreSQL convierta cada tipo.
 */
import { sql } from "drizzle-orm";
import { audit } from "../audit";
import type { Ctx } from "../context";
import { HttpError } from "../errors";
import { invalidateSettings } from "./settings";

/** Orden de inserción que respeta las llaves foráneas. */
export const TABLES = [
  "role", "permission", "role_permission", "member", "app_user", "shift_definition", "work_calendar", "shift_assignment", "time_off",
  "project", "project_member", "phase", "routine_template", "activity", "activity_assignment", "activity_dependency", "checklist_item",
  "time_entry", "evidence", "channel", "comment", "reminder", "notification", "audit_log", "ai_proposal", "setting",
] as const;

export async function exportAll(c: Ctx) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador exporta respaldos.");
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const res = await c.db.execute(sql.raw(`select coalesce(json_agg(t), '[]'::json) as rows from "${t}" t`));
    const rows = (res as unknown as { rows: { rows: unknown[] }[] }).rows;
    data[t] = rows[0]?.rows ?? [];
  }
  await audit(c.db, { userId: c.session.userId, entityType: "system", action: "backup" });
  return { app: "ingenieria-team-control", version: 1, exportedAt: new Date().toISOString(), tables: data };
}

export async function restoreAll(c: Ctx, dump: unknown, confirm: string) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador restaura respaldos.");
  if (confirm !== "RESTAURAR") throw new HttpError(422, "Escribe RESTAURAR para confirmar.");
  const d = dump as { app?: string; tables?: Record<string, unknown[]> };
  if (d?.app !== "ingenieria-team-control" || !d.tables) throw new HttpError(422, "El archivo no es un respaldo de esta aplicación.");
  if (!Array.isArray(d.tables.app_user) || !d.tables.app_user.length) throw new HttpError(422, "El respaldo no contiene usuarios; se rechazó para no dejarte sin acceso.");
  await c.db.transaction(async (tx) => {
    await tx.execute(sql.raw(`truncate ${TABLES.map((t) => `"${t}"`).join(", ")} cascade`));
    for (const t of TABLES) {
      const rows = d.tables![t];
      if (!Array.isArray(rows) || !rows.length) continue;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = JSON.stringify(rows.slice(i, i + 500));
        await tx.execute(sql`insert into ${sql.raw(`"${t}"`)} select * from json_populate_recordset(null::${sql.raw(`"${t}"`)}, ${chunk}::json)`);
      }
    }
    await audit(tx, { userId: c.session.userId, entityType: "system", action: "restore", after: { exportedAt: (d as { exportedAt?: string }).exportedAt } });
  });
  invalidateSettings();
}
