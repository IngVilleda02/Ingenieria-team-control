/**
 * Pruebas de extremo a extremo de las Fases 2 a 8 sobre PostgreSQL real en memoria.
 */
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.PGLITE_DIR = "memory://";
process.env.EVIDENCE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "itc-ev-"));
delete process.env.DATABASE_URL;
delete process.env.AI_API_KEY;
process.env.AI_PROVIDER = "gemini";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

const { getDb, schema } = await import("@/db/client");
const { runSetup } = await import("@/server/services/setup");
const A = await import("@/server/services/activities");
const P = await import("@/server/services/projects");
const M = await import("@/server/services/members");
const W = await import("@/server/services/workload");
const I = await import("@/server/services/indicators");
const AI = await import("@/server/services/ai");
const { setMockProvider } = await import("@/ai/provider");
const EV = await import("@/server/services/evidence");
const R = await import("@/server/services/reminders");
const B = await import("@/server/services/backup");
const REP = await import("@/server/services/reports");
const U = await import("@/server/services/users");
const { addDays, todayIn } = await import("@/server/services/metrics");
const { mondayOf } = W;
import type { Ctx } from "@/server/context";
import { eq } from "drizzle-orm";

let c: Ctx;
let today: string;
let juan: { id: string }, pedro: { id: string }, ana: { id: string };
let projectId: string;

beforeAll(async () => {
  const db = await getDb();
  const admin = await runSetup({ fullName: "Carlos Arcos", email: "carlos@planta.mx", password: "ClaveSegura2026" });
  c = { db, scope: "all", session: { userId: admin.userId, memberId: admin.memberId, role: "admin", name: admin.name, email: admin.email } };
  today = todayIn("America/Mexico_City");
});

describe("Fase 3 · equipo, turnos y rutinas", () => {
  it("registra a los tres colaboradores", async () => {
    juan = await M.createMember(c, { fullName: "Juan Pérez", position: "Técnico" });
    pedro = await M.createMember(c, { fullName: "Pedro López", position: "Técnico" });
    ana = await M.createMember(c, { fullName: "Ana Ruiz", position: "Ingeniera" });
    expect((await M.listMembers(c)).length).toBe(3);
  });

  it("la disponibilidad respeta turno y descanso: día 12 h − 1 h, noche 8 h − 0.5 h", async () => {
    const mon = addDays(mondayOf(today), 7);
    await M.rotateShifts(c, juan.id, mon, "dia", 2);
    const days = await W.capacityByDay(c, juan.id, mon, addDays(mon, 13));
    expect(days[0]).toMatchObject({ hours: 11, shift: "dia" });
    expect(days[5].hours).toBe(0); // sábado
    expect(days[7]).toMatchObject({ hours: 7.5, shift: "noche" });
  });

  it("las ausencias quitan disponibilidad", async () => {
    const mon = addDays(mondayOf(today), 7);
    await M.addTimeOff(c, juan.id, mon, mon, "Curso");
    const [d] = await W.capacityByDay(c, juan.id, mon, mon);
    expect(d.hours).toBe(0);
  });

  it("genera instancias habituales sin duplicar", async () => {
    await M.addRoutine(c, pedro.id, { title: "Ronda de jigs", frequency: "diaria", estimatedH: 1 });
    const from = mondayOf(today);
    const first = await M.generateRoutineInstances(c, from, addDays(from, 6));
    const again = await M.generateRoutineInstances(c, from, addDays(from, 6));
    expect(first).toBe(5);
    expect(again).toBe(0);
    const rows = await A.listAssignments(c, { memberId: pedro.id, origin: "habitual" });
    expect(rows.length).toBe(5);
  });
});

describe("Fase 2 · proyectos y actividades", () => {
  it("crea proyecto con fases", async () => {
    const p = await P.createProject(c, { name: "Mejora estación de soldadura", status: "en_progreso", startDate: addDays(today, -10), dueDate: addDays(today, 20) });
    projectId = p.id;
    await P.addPhase(c, projectId, "Diagnóstico");
    expect((await P.getProject(c, projectId)).phases).toHaveLength(1);
    await expect(P.createProject(c, { name: "X", dueDate: "2026-01-01", startDate: "2026-02-01" })).rejects.toThrow();
  });

  it("asigna una actividad a varias personas, cada una con su avance", async () => {
    const a = await A.createActivity(c, { title: "Revisar sensores", origin: "extraordinaria", projectId, memberIds: [juan.id, ana.id], estimatedH: 3, dueDate: addDays(today, 2), checklist: ["Sensor 1", "Sensor 2"] });
    const d = await A.getActivity(c, a.id);
    expect(d.assignments).toHaveLength(2);
    expect(d.checklist).toHaveLength(2);
    expect(d.history.some((h) => h.action === "assign")).toBe(true);
    const ja = d.assignments.find((x) => x.a.memberId === juan.id)!.a;
    await A.setAssignmentStatus(c, ja.id, "en_proceso", 40);
    await A.addTimeEntry(c, ja.id, 90, "Medición");
    const after = await A.getActivity(c, a.id);
    const j2 = after.assignments.find((x) => x.a.memberId === juan.id)!.a;
    const a2 = after.assignments.find((x) => x.a.memberId === ana.id)!.a;
    expect(j2.status).toBe("en_proceso");
    expect(j2.startedAt).not.toBeNull();
    expect(Number(j2.actualH)).toBe(1.5);
    expect(a2.status).toBe("pendiente");
  });

  it("las personales siempre son del administrador", async () => {
    const a = await A.createActivity(c, { title: "Documentar avances", origin: "personal", memberIds: [juan.id] });
    const d = await A.getActivity(c, a.id);
    expect(d.assignments.map((x) => x.a.memberId)).toEqual([c.session.memberId]);
  });

  it("dependencias: bloquea iniciar y rechaza ciclos", async () => {
    const first = await A.createActivity(c, { title: "Diagnosticar falla", origin: "extraordinaria", memberIds: [ana.id] });
    const second = await A.createActivity(c, { title: "Corregir falla", origin: "extraordinaria", memberIds: [ana.id], dependsOn: [first.id] });
    const asg = (await A.getActivity(c, second.id)).assignments[0].a;
    await expect(A.setAssignmentStatus(c, asg.id, "en_proceso")).rejects.toThrow(/Primero debe terminarse/);
    await expect(A.updateActivity(c, first.id, { dependsOn: [second.id] })).rejects.toThrow(/ciclo/);
  });

  it("evidencia requerida impide completar; completar fija fin real y 100 %", async () => {
    const a = await A.createActivity(c, { title: "Validar seguridad", origin: "extraordinaria", memberIds: [juan.id], evidenceRequired: true });
    const asg = (await A.getActivity(c, a.id)).assignments[0].a;
    await expect(A.setAssignmentStatus(c, asg.id, "completada")).rejects.toThrow(/requiere evidencia/);
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    await EV.uploadEvidence(c, new File([png], "foto.png", { type: "image/png" }), { activityId: a.id, memberId: juan.id });
    await A.setAssignmentStatus(c, asg.id, "completada");
    const done = (await A.getActivity(c, a.id)).assignments[0].a;
    expect(done.progressPct).toBe(100);
    expect(done.finishedAt).not.toBeNull();
  });

  it("reprogramar queda en historial", async () => {
    const a = await A.createActivity(c, { title: "Preparar programa", origin: "extraordinaria", memberIds: [pedro.id], dueDate: addDays(today, 1) });
    await A.updateActivity(c, a.id, { dueDate: addDays(today, 5) });
    const h = (await A.getActivity(c, a.id)).history.find((x) => x.action === "reschedule");
    expect(h?.after).toMatchObject({ dueDate: addDays(today, 5) });
  });
});

describe("Fase 4 · indicadores y carga", () => {
  it("separa habitual y extraordinaria", async () => {
    const ind = await I.memberIndicators(c, pedro.id);
    expect(ind.habitual.total).toBe(5);
    expect(ind.extraordinaria.total).toBe(1);
    expect(ind.habitual.onTime).toBeNull(); // sin muestra suficiente
  });

  it("advierte sobrecarga antes de asignar", async () => {
    const prev = await W.previewAssignment(c, [ana.id], 80, addDays(today, 1));
    expect(prev[0].warn).toBe(true);
    expect(prev[0].message).toMatch(/¿Deseas continuar/);
    const light = await W.previewAssignment(c, [ana.id], 0.5, addDays(today, 10));
    expect(light[0].warn).toBe(false);
  });

  it("proyección de proyecto", async () => {
    const d = await P.getProject(c, projectId);
    expect(d.metrics.elapsedPct).toBeGreaterThan(0);
    expect(d.metrics.pendingCount).toBeGreaterThan(0);
  });
});

describe("Fase 5 · IA con aprobación", () => {
  it("desglose básico sin IA: tres fases del ejemplo", () => {
    const plan = AI.basicPlan("Necesito desarrollar una mejora en una estación de soldadura. Primero debo revisar las condiciones de operación, verificar sensores, revisar el PLC, identificar las fallas, generar una propuesta de automatización, realizar modificaciones, probar el funcionamiento y documentar los resultados.", today);
    expect(plan.phases.map((p) => p.name)).toEqual(["Diagnóstico", "Desarrollo", "Validación"]);
    expect(plan.phases[0].activities.length).toBeGreaterThanOrEqual(3);
    expect(plan.source).toBe("basico");
    expect(plan.phases[0].activities.map((a) => a.title)).toContain("Revisar las condiciones de operación");
    expect(plan.phases[2].activities.map((a) => a.title)).toEqual(["Probar el funcionamiento", "Documentar los resultados"]);
    for (const a of plan.phases.flatMap((p) => p.activities)) expect([0, 6]).not.toContain(new Date(`${a.startDate}T12:00:00Z`).getUTCDay());
  });

  it("la propuesta no crea nada hasta aprobarla; al aprobar crea proyecto, fases y asignaciones", async () => {
    const before = (await P.listProjects(c)).length;
    const prop = await AI.proposePlan(c, "Necesito instalar una cortina en el contenedor. Revisar medidas, diseñar el soporte, fabricar la cortina, probar el funcionamiento y documentar.");
    expect((await P.listProjects(c)).length).toBe(before);
    const flat = (prop.payload as { phases: { activities: unknown[] }[] }).phases.flatMap((p) => p.activities);
    const edits = flat.map((_, i) => ({ include: i !== 0, title: "", memberId: i === 1 ? juan.id : null, startDate: today, dueDate: addDays(today, 3), estimatedH: 2 }));
    const pid = await AI.approvePlan(c, prop.id, edits, "Cortina de contenedor");
    const d = await P.getProject(c, pid);
    expect(d.project.name).toBe("Cortina de contenedor");
    expect(new Set(d.items.map((i) => i.activityId)).size).toBe(flat.length - 1);
    expect(d.items.some((i) => i.memberId === juan.id && i.origin === "extraordinaria")).toBe(true);
    await expect(AI.approvePlan(c, prop.id, edits)).rejects.toThrow(/ya fue decidida/);
  });

  it("intérprete básico de instrucciones", async () => {
    const prop = await AI.proposeInstruction(c, "Agrega una actividad para revisar el sensor de presencia y asígnasela a Juan para mañana");
    const ins = prop.payload as { memberIds: string[]; dueDate: string; title: string };
    expect(ins.memberIds).toEqual([juan.id]);
    expect(ins.dueDate).toBe(addDays(today, 1));
    expect(ins.title.toLowerCase()).toContain("sensor de presencia");
  });

  it("asistente: responde con datos y solo reprograma tras aprobar", async () => {
    process.env.AI_API_KEY = "prueba";
    const target = (await A.listAssignments(c, { memberId: pedro.id, origin: "extraordinaria" }))[0];
    setMockProvider(() => ({ answer: "**[Registrado]** Pedro tiene 1 extraordinaria.", proposal: { type: "reprogramacion", summary: "Mover a la próxima semana", items: [{ activityId: target.activityId, newDueDate: addDays(today, 9) }, { activityId: "00000000-0000-4000-8000-000000000000", newDueDate: today }] } }));
    const res = await AI.askAssistant(c, "Reprograma lo de Pedro para la próxima semana");
    expect(res.answer).toContain("[Registrado]");
    expect(res.proposalId).toBeTruthy();
    expect((await A.getActivity(c, target.activityId)).activity.dueDate).toBe(target.dueDate); // sin cambios aún
    const prop = await AI.getProposal(c, res.proposalId!);
    expect((prop.payload as { items: unknown[] }).items).toHaveLength(1); // id inventado descartado
    await AI.approveReschedule(c, res.proposalId!, [true]);
    expect((await A.getActivity(c, target.activityId)).activity.dueDate).toBe(addDays(today, 9));
    setMockProvider(null);
    delete process.env.AI_API_KEY;
  });
});

describe("Fase 6 · evidencias y reportes", () => {
  it("rechaza tipos no permitidos y contenido falso", async () => {
    await expect(EV.uploadEvidence(c, new File([Buffer.from("MZ")], "virus.exe"), {})).rejects.toThrow(/no permitido/);
    await expect(EV.uploadEvidence(c, new File([Buffer.from("hola")], "foto.png"), {})).rejects.toThrow(/no corresponde/);
    const ok = await EV.uploadEvidence(c, new File([Buffer.from("%PDF-1.4 prueba")], "plano.pdf"), { projectId, description: "Plano" });
    expect(ok.sha256).toHaveLength(64);
    expect((await EV.listEvidence(c, { projectId })).length).toBeGreaterThanOrEqual(1);
  });

  it("genera PDF y Excel con datos reales", async () => {
    const period = await REP.periodFrom("mensual");
    const gen = await REP.buildReport(c, "general", period);
    const pdf = await REP.toPdf(gen, "hoy");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const xlsx = await REP.toXlsx(await REP.buildReport(c, "individual", period, juan.id), "hoy");
    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
    const proj = await REP.buildReport(c, "proyecto", period, projectId);
    expect(proj.table.rows.length).toBeGreaterThan(0);
  });
});

describe("Fase 7 · recordatorios y notificaciones", () => {
  it("dispara recordatorios vencidos y alertas automáticas sin duplicar", async () => {
    await R.createReminders(c, { title: "Revisión semanal", kind: "revision", scope: "proyecto", projectId, eventAt: new Date(Date.now() + 3600e3), offsets: ["24h"] });
    await A.createActivity(c, { title: "Algo vencido", origin: "extraordinaria", memberIds: [ana.id], dueDate: addDays(today, -2) });
    await R.syncNotifications(c.db);
    const n1 = await R.listNotifications(c, 200);
    await R.syncNotifications(c.db);
    const n2 = await R.listNotifications(c, 200);
    expect(n1.length).toBe(n2.length);
    expect(n1.some((n) => n.title === "Revisión semanal" && n.scope === "proyecto")).toBe(true);
    expect(n1.some((n) => n.title === "Vencida: Algo vencido")).toBe(true);
    await R.markRead(c, "all");
    expect(await R.unreadCount(c)).toBe(0);
  });
});

describe("Fase 8 · multiusuario y respaldo", () => {
  it("crear cuentas de colaborador está desactivado salvo habilitación", async () => {
    await expect(U.createUserForMember(c, { memberId: juan.id, email: "juan@planta.mx", role: "colaborador", password: "ClaveJuan2026" })).rejects.toThrow(/no está habilitado/);
    const u = await U.createUserForMember(c, { memberId: juan.id, email: "juan@planta.mx", role: "colaborador", password: "ClaveJuan2026" }, { force: true });
    expect(u.email).toBe("juan@planta.mx");
  });

  it("un colaborador solo ve lo suyo y no puede asignar", async () => {
    const cj: Ctx = { db: c.db, scope: "own", session: { userId: "x", memberId: juan.id, role: "colaborador", name: "Juan", email: "juan@planta.mx" } };
    const rows = await A.listAssignments(cj);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.memberId === juan.id)).toBe(true);
    await expect(A.createActivity(cj, { title: "Asignar a Ana", origin: "extraordinaria", memberIds: [ana.id] })).rejects.toThrow(/No puedes asignar/);
    const other = (await A.listAssignments(c, { memberId: ana.id }))[0];
    await expect(A.getActivity(cj, other.activityId)).rejects.toThrow(/No tienes acceso/);
  });

  it("respaldo completo y restauración", async () => {
    const dump = await B.exportAll(c);
    const counts = Object.fromEntries(Object.entries(dump.tables).map(([k, v]) => [k, v.length]));
    await A.createActivity(c, { title: "Después del respaldo", origin: "personal", memberIds: [c.session.memberId!] });
    await expect(B.restoreAll(c, dump, "no")).rejects.toThrow(/RESTAURAR/);
    await B.restoreAll(c, JSON.parse(JSON.stringify(dump)), "RESTAURAR");
    const again = await B.exportAll(c);
    for (const [k, n] of Object.entries(counts)) {
      if (k === "audit_log") continue; // la restauración agrega su propio registro
      expect(again.tables[k].length, k).toBe(n);
    }
    const titles = (await c.db.select({ t: schema.activity.title }).from(schema.activity)).map((x) => x.t);
    expect(titles).not.toContain("Después del respaldo");
    const [u] = await c.db.select().from(schema.appUser).where(eq(schema.appUser.email, "carlos@planta.mx"));
    expect(u).toBeTruthy();
  });
});
