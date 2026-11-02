/**
 * Prueba de extremo a extremo de la Fase 1 sobre una base PostgreSQL real (PGlite en memoria):
 * migraciones, configuración inicial, permisos, auditoría y dashboard calculado desde datos.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

let session: Record<string, unknown> | null = null;
vi.mock("@/server/auth", async (orig) => {
  const real = await orig<typeof import("@/server/auth")>();
  return { ...real, getSession: async () => session };
});

const { getDb, schema } = await import("@/db/client");
const { runSetup, needsSetup } = await import("@/server/services/setup");
const { getDashboard } = await import("@/server/services/dashboard");
const { scopeFor } = await import("@/server/permissions");
const { verifyPassword } = await import("@/server/auth");
const { todayIn, addDays } = await import("@/server/services/metrics");

let admin: Awaited<ReturnType<typeof runSetup>>;

beforeAll(async () => {
  await getDb();
});

describe("configuración inicial", () => {
  it("pide configuración cuando no hay usuarios", async () => {
    expect(await needsSetup()).toBe(true);
  });

  it("rechaza contraseñas débiles", async () => {
    await expect(runSetup({ fullName: "Carlos Arcos", email: "a@b.mx", password: "corta" })).rejects.toThrow();
  });

  it("crea administrador, roles, permisos, turnos y bitácora", async () => {
    admin = await runSetup({ fullName: "Carlos Arcos", position: "Ingeniero de Procesos", email: "Admin@Planta.MX", password: "ClaveSegura2026" });
    const db = await getDb();
    const [u] = await db.select().from(schema.appUser);
    expect(u.email).toBe("admin@planta.mx");
    expect(u.passwordHash).not.toContain("ClaveSegura2026");
    expect(await verifyPassword("ClaveSegura2026", u.passwordHash)).toBe(true);
    expect((await db.select().from(schema.role)).map((r) => r.code).sort()).toEqual(["admin", "colaborador", "supervisor"]);
    expect((await db.select().from(schema.shiftDefinition)).length).toBe(3);
    const log = await db.select().from(schema.auditLog);
    expect(log.some((l) => l.action === "setup" && l.userId === u.id)).toBe(true);
    expect(await needsSetup()).toBe(false);
  });

  it("no permite configurar dos veces", async () => {
    await expect(runSetup({ fullName: "Otro", email: "x@y.mx", password: "OtraClave2026" })).rejects.toThrow(/ya fue configurado/);
  });
});

describe("permisos en el servidor", () => {
  it("colaborador no puede asignar ni administrar usuarios; admin sí", () => {
    expect(scopeFor("colaborador", "activity.assign")).toBeNull();
    expect(scopeFor("colaborador", "user.manage")).toBeNull();
    expect(scopeFor("colaborador", "activity.view")).toBe("own");
    expect(scopeFor("supervisor", "activity.assign")).toBe("team");
    expect(scopeFor("admin", "user.manage")).toBe("all");
  });
});

describe("dashboard con datos reales", () => {
  it("vacío: ceros e «información insuficiente» (null)", async () => {
    const s = { userId: admin.userId, memberId: admin.memberId, role: "admin" as const, name: admin.name, email: admin.email };
    const d = await getDashboard(s, "all");
    expect(d.kpis.activitiesPending).toBe(0);
    expect(d.kpis.teamCompletion).toBeNull();
    expect(d.kpis.efficiency).toBeNull();
    expect(d.hasProductivity).toBe(false);
    expect(d.teamCards).toEqual([]);
  });

  it("separa personales, habituales y extraordinarias y detecta vencidas", async () => {
    const db = await getDb();
    const today = todayIn("America/Mexico_City");
    const [juan] = await db.insert(schema.member).values({ fullName: "Juan Pérez", position: "Técnico" }).returning();
    const [proj] = await db.insert(schema.project).values({ name: "Mejora estación de soldadura", status: "en_progreso", dueDate: addDays(today, 20) }).returning();

    const mk = async (title: string, origin: "personal" | "habitual" | "extraordinaria", memberId: string, o: Record<string, unknown> = {}) => {
      const [a] = await db.insert(schema.activity).values({ title, origin, projectId: proj.id, estimatedH: "2", dueDate: (o.dueDate as string) ?? addDays(today, 3) }).returning();
      await db.insert(schema.activityAssignment).values({ activityId: a.id, memberId, status: (o.status as never) ?? "pendiente", finishedAt: (o.finishedAt as Date) ?? null, actualH: (o.actualH as string) ?? null });
    };
    await mk("Revisar PLC", "personal", admin.memberId);
    await mk("Ronda de jigs", "habitual", juan.id, { status: "completada", finishedAt: new Date(), actualH: "2" });
    await mk("Revisar sensor de presencia", "extraordinaria", juan.id, { dueDate: addDays(today, -1) });
    await mk("Bloqueo en celda", "extraordinaria", juan.id, { status: "bloqueada" });

    const s = { userId: admin.userId, memberId: admin.memberId, role: "admin" as const, name: admin.name, email: admin.email };
    const d = await getDashboard(s, "all");
    expect(d.kpis.activitiesPending).toBe(3);
    expect(d.kpis.activitiesCompleted).toBe(1);
    expect(d.kpis.activitiesOverdue).toBe(1);
    expect(d.kpis.extraordinaryOpen).toBe(2);
    expect(d.kpis.teamAssigned).toBe(3); // la personal no cuenta como del equipo
    expect(d.teamCards).toHaveLength(1);
    expect(d.teamCards[0]).toMatchObject({ name: "Juan Pérez", completed: 1, pending: 2, overdue: 1 });
    expect(d.alerts.map((a) => a.kind)).toEqual(expect.arrayContaining(["Vencida", "Bloqueada"]));
    expect(d.hasProductivity).toBe(true);
    expect(d.projectProgress[0].completion).toBe(25);

    // Alcance «own»: un colaborador solo vería lo suyo
    const own = await getDashboard({ ...s, memberId: juan.id, role: "colaborador" }, "own");
    expect(own.kpis.activitiesPending).toBe(2);
  });
});
