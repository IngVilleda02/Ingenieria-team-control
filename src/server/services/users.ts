/**
 * Fase 8 — preparación multiusuario. Las cuentas de colaborador y supervisor ya se pueden crear
 * en el modelo y en los permisos, pero la creación desde la interfaz queda desactivada
 * hasta que se defina MULTIUSER_ENABLED=true (decisión del documento de diseño).
 */
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/db/client";
import { hashPassword } from "../auth";
import { audit } from "../audit";
import type { Ctx } from "../context";
import { HttpError } from "../errors";
import { ROLE_MATRIX, type RoleCode } from "../permissions";

export const multiuserEnabled = () => process.env.MULTIUSER_ENABLED === "true";

export async function listUsers(c: Ctx) {
  if (c.scope !== "all") throw new HttpError(403, "Sin permiso.");
  return c.db
    .select({ id: schema.appUser.id, email: schema.appUser.email, isActive: schema.appUser.isActive, lastLoginAt: schema.appUser.lastLoginAt, role: schema.role.code, member: schema.member.fullName })
    .from(schema.appUser)
    .innerJoin(schema.role, eq(schema.role.id, schema.appUser.roleId))
    .leftJoin(schema.member, eq(schema.member.id, schema.appUser.memberId))
    .orderBy(asc(schema.appUser.email));
}

const userInput = z.object({
  memberId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["supervisor", "colaborador"]),
  password: z.string().min(10).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),
});

export async function createUserForMember(c: Ctx, input: z.input<typeof userInput>, opts: { force?: boolean } = {}) {
  if (c.scope !== "all") throw new HttpError(403, "Solo el administrador crea cuentas.");
  if (!multiuserEnabled() && !opts.force) throw new HttpError(409, "El acceso de colaboradores aún no está habilitado (MULTIUSER_ENABLED).");
  const d = userInput.parse(input);
  const [role] = await c.db.select().from(schema.role).where(eq(schema.role.code, d.role));
  const [m] = await c.db.select().from(schema.member).where(eq(schema.member.id, d.memberId));
  if (!role || !m) throw new HttpError(404, "Rol o persona no encontrados.");
  return c.db.transaction(async (tx) => {
    const [u] = await tx.insert(schema.appUser).values({ email: d.email, passwordHash: await hashPassword(d.password), roleId: role.id, memberId: d.memberId }).returning({ id: schema.appUser.id, email: schema.appUser.email });
    await audit(tx, { userId: c.session.userId, entityType: "member", entityId: d.memberId, action: "user_create", after: { email: d.email, role: d.role } });
    return u;
  });
}

export const roleMatrix = () => ROLE_MATRIX as Record<RoleCode, Record<string, string>>;
