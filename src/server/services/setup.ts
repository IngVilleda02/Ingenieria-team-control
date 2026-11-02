import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { hashPassword } from "../auth";
import { audit } from "../audit";
import { HttpError } from "../errors";
import { PERMISSIONS, ROLE_MATRIX, ROLE_NAMES, type RoleCode } from "../permissions";
import { DEFAULT_SETTINGS } from "./settings";

export const setupSchema = z.object({
  fullName: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  position: z.string().trim().max(120).optional().default(""),
  area: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().toLowerCase().email("Correo no válido."),
  password: z
    .string()
    .min(10, "Mínimo 10 caracteres.")
    .max(128)
    .regex(/[A-Za-z]/, "Incluye al menos una letra.")
    .regex(/[0-9]/, "Incluye al menos un número."),
});

export async function needsSetup() {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(schema.appUser);
  return r.n === 0;
}

/** Primer arranque: catálogos base + cuenta del administrador. Solo funciona si no hay usuarios. */
export async function runSetup(input: z.input<typeof setupSchema>) {
  const data = setupSchema.parse(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ n: count() }).from(schema.appUser);
    if (existing.n > 0) throw new HttpError(409, "El sistema ya fue configurado.");

    // Permisos y roles
    const permRows = await tx
      .insert(schema.permission)
      .values(Object.entries(PERMISSIONS).map(([code, description]) => ({ code, description })))
      .onConflictDoNothing()
      .returning();
    const allPerms = permRows.length ? permRows : await tx.select().from(schema.permission);
    const permId = new Map(allPerms.map((p) => [p.code, p.id]));

    const roleIds = {} as Record<RoleCode, string>;
    for (const code of Object.keys(ROLE_MATRIX) as RoleCode[]) {
      const [r] = await tx
        .insert(schema.role)
        .values({ code, name: ROLE_NAMES[code] })
        .onConflictDoUpdate({ target: schema.role.code, set: { name: ROLE_NAMES[code] } })
        .returning();
      roleIds[code] = r.id;
      const grants = Object.entries(ROLE_MATRIX[code]).map(([p, scope]) => ({
        roleId: r.id,
        permissionId: permId.get(p)!,
        scope: scope!,
      }));
      if (grants.length) await tx.insert(schema.rolePermission).values(grants).onConflictDoNothing();
    }

    // Disponibilidad: lunes a viernes; turno día 12 h, noche 8 h (horas editables en Configuración)
    await tx
      .insert(schema.shiftDefinition)
      .values([
        { kind: "dia", startTime: "06:00", hours: "12", breakMin: 60 },
        { kind: "noche", startTime: "20:00", hours: "8", breakMin: 30 },
        { kind: "descanso", startTime: "00:00", hours: "0", breakMin: 0 },
      ])
      .onConflictDoNothing();
    await tx
      .insert(schema.workCalendar)
      .values([1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ memberId: null, weekday, isWorkday: weekday <= 5 })))
      .onConflictDoNothing();

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await tx.insert(schema.setting).values({ key, value }).onConflictDoNothing();
    }

    // Administrador
    const [adminMember] = await tx
      .insert(schema.member)
      .values({
        fullName: data.fullName,
        position: data.position || null,
        area: data.area || null,
        isAdmin: true,
        internalCode: "ADM-001",
      })
      .returning();
    const [user] = await tx
      .insert(schema.appUser)
      .values({
        email: data.email,
        passwordHash: await hashPassword(data.password),
        roleId: roleIds.admin,
        memberId: adminMember.id,
      })
      .returning();
    await tx.update(schema.member).set({ createdBy: user.id }).where(eq(schema.member.id, adminMember.id));

    await audit(tx, {
      userId: user.id,
      entityType: "system",
      action: "setup",
      after: { admin: data.email, member: adminMember.fullName },
    });

    return { userId: user.id, memberId: adminMember.id, name: adminMember.fullName, email: user.email };
  });
}
