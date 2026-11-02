import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import { getDb, schema, type Db } from "@/db/client";
import { requirePermission, type Session } from "./auth";
import type { PermissionCode, Scope } from "./permissions";
import { HttpError } from "./errors";

export type Ctx = { db: Db; session: Session; scope: Scope };

/** Abre un contexto autorizado: sesión verificada + alcance del permiso pedido. */
export async function ctx(perm: PermissionCode): Promise<Ctx> {
  const { session, scope } = await requirePermission(perm);
  return { db: await getDb(), session, scope };
}

/** Personas que el usuario puede ver según su alcance (null = todas). */
export async function visibleMemberIds(c: Ctx): Promise<string[] | null> {
  if (c.scope === "all") return null;
  if (!c.session.memberId) return [];
  if (c.scope === "own") return [c.session.memberId];
  const team = await c.db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(or(eq(schema.member.supervisorId, c.session.memberId), eq(schema.member.id, c.session.memberId)));
  return team.map((t) => t.id);
}

/** Filtro SQL de asignaciones por alcance. */
export async function assignmentScope(c: Ctx): Promise<SQL | undefined> {
  const ids = await visibleMemberIds(c);
  if (ids === null) return undefined;
  if (ids.length === 0) return eq(schema.activityAssignment.memberId, "00000000-0000-0000-0000-000000000000");
  return inArray(schema.activityAssignment.memberId, ids);
}

export async function assertMemberVisible(c: Ctx, memberId: string) {
  const ids = await visibleMemberIds(c);
  if (ids !== null && !ids.includes(memberId)) throw new HttpError(403, "No tienes acceso a esta persona.");
}

export const andAll = (...parts: (SQL | undefined)[]) => and(...parts.filter(Boolean));
