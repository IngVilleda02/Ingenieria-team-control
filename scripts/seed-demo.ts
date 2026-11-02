/**
 * Datos de DEMOSTRACIÓN en una base separada (no toca tus datos reales).
 *
 *   npm run demo:seed      → crea ./data/demo con datos de ejemplo
 *   npm run demo           → abre la app sobre esa base en http://localhost:3001
 *
 * Usuario demo: demo@teamcontrol.local / Demo2026segura
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

const DIR = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "demo");
process.env.PGLITE_DIR = DIR;
process.env.EVIDENCE_DIR ??= path.join(path.dirname(DIR), "demo-evidence");
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;

async function main() {
  if (fs.existsSync(DIR)) fs.rmSync(DIR, { recursive: true, force: true });
  if (fs.existsSync(process.env.EVIDENCE_DIR!)) fs.rmSync(process.env.EVIDENCE_DIR!, { recursive: true, force: true });

  const { getDb, schema } = await import("../src/db/client");
  const { runSetup } = await import("../src/server/services/setup");
  const A = await import("../src/server/services/activities");
  const P = await import("../src/server/services/projects");
  const M = await import("../src/server/services/members");
  const R = await import("../src/server/services/reminders");
  const EV = await import("../src/server/services/evidence");
  const { addDays, todayIn } = await import("../src/server/services/metrics");
  const { mondayOf } = await import("../src/server/services/workload");

  const db = await getDb();
  const admin = await runSetup({ fullName: "Carlos Arcos", position: "Ingeniero de Procesos", area: "Ingeniería", email: "demo@teamcontrol.local", password: "Demo2026segura" });
  const c = { db, scope: "all" as const, session: { userId: admin.userId, memberId: admin.memberId, role: "admin" as const, name: admin.name, email: admin.email } };
  const today = todayIn("America/Mexico_City");
  // Fechas de ejemplo en días hábiles (sábado → viernes, domingo → lunes), salvo «hoy».
  const d = (n: number) => {
    const x = addDays(today, n);
    if (n === 0) return x;
    const wd = new Date(`${x}T12:00:00Z`).getUTCDay();
    return wd === 6 ? addDays(x, -1) : wd === 0 ? addDays(x, 1) : x;
  };
  const at = (day: string, hour = 15) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00-06:00`);

  // ── Equipo ──
  const juan = await M.createMember(c, { fullName: "Juan Pérez", internalCode: "ING-014", position: "Técnico de automatización", area: "Ingeniería", specialty: "PLC y robots Fanuc", responsibilities: "Soporte a líneas de soldadura, respaldos de programas de robot y PLC, rondas de inspección de jigs.", joinedAt: d(-60) });
  const pedro = await M.createMember(c, { fullName: "Pedro López", internalCode: "ING-021", position: "Técnico de mantenimiento", area: "Ingeniería", specialty: "Mecánica y neumática", responsibilities: "Ajuste de jigs, cambios de herramental, mantenimiento preventivo de pinzas.", joinedAt: d(-60) });
  const ana = await M.createMember(c, { fullName: "Ana Ruiz", internalCode: "ING-030", position: "Ingeniera de procesos jr.", area: "Ingeniería", specialty: "Calidad y documentación", responsibilities: "Hojas de proceso, análisis de defectos, control de cambios y escaneos de referencia.", joinedAt: d(-45) });

  // Turnos rotativos (semana actual y 5 siguientes) y una ausencia
  const mon = mondayOf(today);
  await M.rotateShifts(c, juan.id, addDays(mon, -42), "dia", 12);
  await M.rotateShifts(c, pedro.id, addDays(mon, -42), "noche", 12);
  await M.rotateShifts(c, ana.id, addDays(mon, -42), "dia", 12);
  await M.addTimeOff(c, pedro.id, addDays(mon, 9), addDays(mon, 10), "Curso de neumática");

  // Actividades habituales recurrentes
  await M.addRoutine(c, juan.id, { title: "Respaldo de programas de robot", frequency: "semanal", weekday: 1, estimatedH: 1.5, complexity: 2 });
  await M.addRoutine(c, pedro.id, { title: "Ronda de inspección de jigs Línea 2", frequency: "diaria", estimatedH: 1, complexity: 1 });
  await M.addRoutine(c, ana.id, { title: "Actualizar hojas de proceso", frequency: "semanal", weekday: 3, estimatedH: 2, complexity: 2 });
  await M.generateRoutineInstances(c, addDays(mon, -35), addDays(mon, 13));

  // ── Proyectos ──
  const soldadura = await P.createProject(c, { name: "Mejora de estación de soldadura", category: "Automatización", description: "Reducir paros por falla de sensores y mejorar la secuencia de la estación.", objective: "Bajar paros de la estación 40 % y documentar la nueva secuencia.", priority: "alta", status: "en_progreso", startDate: d(-28), dueDate: d(16), budget: 85000, memberIds: [juan.id, ana.id] });
  const cortina = await P.createProject(c, { name: "Cortina de resguardo para contenedor PT", category: "Seguridad", description: "Cubierta retráctil para el contenedor de piezas terminadas en caso de falla de línea.", objective: "Proteger el producto terminado durante paros.", priority: "media", status: "en_progreso", startDate: d(-20), dueDate: d(-1), memberIds: [pedro.id] });
  const jigs = await P.createProject(c, { name: "Igualar jigs Línea 2", category: "Calidad", description: "Homologar jigs T/T 57 y T/T 60 con base en escaneos de referencia.", priority: "alta", status: "en_progreso", startDate: d(-14), dueDate: d(30), memberIds: [pedro.id, ana.id] });
  const mqtt = await P.createProject(c, { name: "Monitoreo de PLC con MQTT", category: "Datos", description: "Piloto de conexión de PLC a una base común de datos.", priority: "media", status: "en_planificacion", startDate: d(3), dueDate: d(60), memberIds: [juan.id] });
  const estandar = await P.createProject(c, { name: "Estándar de secuencias entre celdas", category: "Estándares", description: "Check sheet para secuencias entre celdas y máquinas.", priority: "media", status: "completado", startDate: d(-40), dueDate: d(-10), finishedAt: d(-12), memberIds: [ana.id] });

  const phases: Record<string, Record<string, string>> = {};
  for (const [pid, names] of [[soldadura.id, ["Diagnóstico", "Desarrollo", "Validación"]], [cortina.id, ["Diseño", "Fabricación", "Instalación"]], [jigs.id, ["Escaneo", "Ajuste", "Liberación"]], [mqtt.id, ["Arquitectura", "Piloto"]]] as const) {
    phases[pid] = {};
    for (const n of names) phases[pid][n] = (await P.addPhase(c, pid, n)).id;
  }

  type Spec = {
    title: string; who: string[]; origin: "personal" | "extraordinaria"; project?: string; phase?: string; prio?: "baja" | "media" | "alta" | "critica";
    cx?: number; est: number; start: number; due: number; status?: string; progress?: number; finished?: number; actual?: number; checklist?: string[];
  };
  const me = admin.memberId;
  const specs: Spec[] = [
    // Soldadura
    { title: "Revisar condiciones de operación", who: [juan.id], origin: "extraordinaria", project: soldadura.id, phase: "Diagnóstico", prio: "alta", cx: 2, est: 4, start: -27, due: -24, status: "completada", finished: -24, actual: 4.5 },
    { title: "Verificar sensores de presencia", who: [juan.id], origin: "extraordinaria", project: soldadura.id, phase: "Diagnóstico", prio: "alta", cx: 3, est: 6, start: -24, due: -20, status: "completada", finished: -21, actual: 5, checklist: ["Sensor de pieza", "Sensor de pinza", "Sensor de puerta"] },
    { title: "Revisar entradas y salidas del PLC", who: [me], origin: "personal", project: soldadura.id, phase: "Diagnóstico", prio: "alta", cx: 3, est: 5, start: -20, due: -17, status: "completada", finished: -16, actual: 6 },
    { title: "Documentar fallas encontradas", who: [ana.id], origin: "extraordinaria", project: soldadura.id, phase: "Diagnóstico", prio: "media", cx: 2, est: 3, start: -17, due: -15, status: "completada", finished: -15, actual: 3 },
    { title: "Diseñar propuesta de automatización", who: [me], origin: "personal", project: soldadura.id, phase: "Desarrollo", prio: "critica", cx: 4, est: 10, start: -14, due: -6, status: "completada", finished: -5, actual: 12 },
    { title: "Preparar programa de control", who: [juan.id], origin: "extraordinaria", project: soldadura.id, phase: "Desarrollo", prio: "alta", cx: 4, est: 12, start: -5, due: 2, status: "en_proceso", progress: 60, actual: 7, checklist: ["Rutina de arranque", "Interbloqueos", "Manejo de fallas", "Pantalla HMI"] },
    { title: "Realizar modificaciones eléctricas", who: [juan.id, pedro.id], origin: "extraordinaria", project: soldadura.id, phase: "Desarrollo", prio: "alta", cx: 3, est: 8, start: 2, due: 6 },
    { title: "Validar secuencia en vacío", who: [juan.id], origin: "extraordinaria", project: soldadura.id, phase: "Validación", prio: "alta", cx: 3, est: 4, start: 7, due: 9 },
    { title: "Validar condiciones de seguridad", who: [ana.id], origin: "extraordinaria", project: soldadura.id, phase: "Validación", prio: "critica", cx: 3, est: 3, start: 9, due: 11 },
    { title: "Documentar resultados y liberar mejora", who: [me], origin: "personal", project: soldadura.id, phase: "Validación", prio: "media", cx: 2, est: 4, start: 12, due: 16 },
    // Cortina (atrasado)
    { title: "Tomar medidas del contenedor", who: [pedro.id], origin: "extraordinaria", project: cortina.id, phase: "Diseño", prio: "media", cx: 1, est: 2, start: -19, due: -18, status: "completada", finished: -18, actual: 1.5 },
    { title: "Diseñar soporte de la cortina", who: [me], origin: "personal", project: cortina.id, phase: "Diseño", prio: "media", cx: 3, est: 6, start: -17, due: -12, status: "completada", finished: -10, actual: 8 },
    { title: "Fabricar estructura", who: [pedro.id], origin: "extraordinaria", project: cortina.id, phase: "Fabricación", prio: "alta", cx: 3, est: 10, start: -9, due: -3, status: "en_proceso", progress: 70, actual: 9 },
    { title: "Instalar y probar cortina", who: [pedro.id], origin: "extraordinaria", project: cortina.id, phase: "Instalación", prio: "alta", cx: 2, est: 4, start: -2, due: -1, status: "bloqueada", progress: 0 },
    // Jigs
    { title: "Escanear jig 2 de T/T 57", who: [ana.id], origin: "extraordinaria", project: jigs.id, phase: "Escaneo", prio: "alta", cx: 3, est: 3, start: -13, due: -11, status: "completada", finished: -11, actual: 3.5 },
    { title: "Escanear jig 2 de T/T 60", who: [ana.id], origin: "extraordinaria", project: jigs.id, phase: "Escaneo", prio: "alta", cx: 3, est: 3, start: -11, due: -9, status: "completada", finished: -8, actual: 4 },
    { title: "Comparar escaneos y listar hallazgos", who: [ana.id], origin: "extraordinaria", project: jigs.id, phase: "Escaneo", prio: "alta", cx: 4, est: 5, start: -7, due: -3, status: "en_revision", progress: 90, actual: 5.5 },
    { title: "Ajustar pines y bloques del jig 2", who: [pedro.id], origin: "extraordinaria", project: jigs.id, phase: "Ajuste", prio: "alta", cx: 4, est: 8, start: 1, due: 8 },
    { title: "Escaneo posterior al ajuste", who: [ana.id], origin: "extraordinaria", project: jigs.id, phase: "Liberación", prio: "media", cx: 2, est: 3, start: 9, due: 12 },
    // MQTT
    { title: "Definir arquitectura de datos", who: [me], origin: "personal", project: mqtt.id, phase: "Arquitectura", prio: "media", cx: 4, est: 6, start: 3, due: 10 },
    { title: "Configurar Raspberry Pi con broker MQTT", who: [juan.id], origin: "extraordinaria", project: mqtt.id, phase: "Piloto", prio: "media", cx: 3, est: 6, start: 10, due: 20 },
    // Estándar (terminado)
    { title: "Redactar check sheet de secuencias", who: [ana.id], origin: "extraordinaria", project: estandar.id, prio: "media", cx: 2, est: 4, start: -38, due: -30, status: "completada", finished: -31, actual: 3.5 },
    { title: "Presentar estándar a Producción", who: [me], origin: "personal", project: estandar.id, prio: "alta", cx: 2, est: 2, start: -15, due: -12, status: "completada", finished: -12, actual: 2 },
    // Sueltas
    { title: "Preparar reporte semanal de Ingeniería", who: [me], origin: "personal", prio: "media", cx: 2, est: 2, start: 0, due: 0 },
    { title: "Revisar pendientes del equipo", who: [me], origin: "personal", prio: "alta", cx: 1, est: 1, start: 0, due: 0 },
    { title: "Actualizar respaldo de robot R-05", who: [juan.id], origin: "extraordinaria", prio: "media", cx: 2, est: 2, start: -3, due: -2 },
    { title: "Cambio de herramental en celda 4", who: [pedro.id], origin: "extraordinaria", prio: "critica", cx: 3, est: 5, start: 0, due: 1 },
    { title: "Análisis de defecto de porosidad", who: [ana.id], origin: "extraordinaria", prio: "alta", cx: 4, est: 6, start: -1, due: 3, status: "en_proceso", progress: 30, actual: 2 },
  ];

  const created: Record<string, string> = {};
  for (const s of specs) {
    const a = await A.createActivity(c, {
      title: s.title, origin: s.origin, projectId: s.project ?? null, phaseId: s.project && s.phase ? phases[s.project][s.phase] : null,
      priority: s.prio ?? "media", complexity: s.cx ?? 2, estimatedH: s.est, startDate: d(s.start), dueDate: d(s.due), memberIds: s.who, checklist: s.checklist ?? [],
    });
    created[s.title] = a.id;
    const assigns = (await A.getActivity(c, a.id)).assignments;
    await db.update(schema.activity).set({ assignedAt: at(d(s.start - 1), 9), createdAt: at(d(s.start - 1), 9) }).where(eq(schema.activity.id, a.id));
    for (const { a: as } of assigns) {
      if (!s.status) continue;
      const started = at(d(s.start), 8);
      const done = s.status === "completada";
      await db
        .update(schema.activityAssignment)
        .set({ status: s.status as "completada", progressPct: done ? 100 : (s.progress ?? 0), startedAt: s.status === "bloqueada" ? null : started, finishedAt: done ? at(d(s.finished!), 16) : null, actualH: s.actual ? String(s.actual) : null })
        .where(eq(schema.activityAssignment.id, as.id));
      if (s.actual) await db.insert(schema.timeEntry).values({ assignmentId: as.id, startedAt: started, minutes: Math.round(s.actual * 60), note: "Registro de demostración", createdBy: admin.userId });
      await db.insert(schema.auditLog).values({ userId: admin.userId, entityType: "assignment", entityId: as.id, action: done ? "finish" : "start", after: { status: s.status, activityId: a.id }, at: done ? at(d(s.finished!), 16) : started });
    }
    if (s.checklist && s.progress) {
      const items = (await A.getActivity(c, a.id)).checklist;
      for (const it of items.slice(0, Math.round((items.length * s.progress) / 100))) await db.update(schema.checklistItem).set({ done: true, doneAt: new Date() }).where(eq(schema.checklistItem.id, it.id));
    }
  }
  // Dependencias
  await A.updateActivity(c, created["Validar secuencia en vacío"], { dependsOn: [created["Realizar modificaciones eléctricas"]] });
  await A.updateActivity(c, created["Instalar y probar cortina"], { dependsOn: [created["Fabricar estructura"]] });

  // Habituales: cerrar las pasadas (la mayoría a tiempo)
  const habit = await A.listAssignments(c, { origin: "habitual" });
  let k = 0;
  for (const h of habit.filter((x) => x.dueDate && x.dueDate < today)) {
    k++;
    const late = k % 6 === 0;
    const missed = k % 11 === 0;
    if (missed) continue;
    const fin = late ? addDays(h.dueDate!, 1) : h.dueDate!;
    await db.update(schema.activityAssignment).set({ status: "completada", progressPct: 100, startedAt: at(h.dueDate!, 8), finishedAt: at(fin, 14), actualH: String((h.estimatedH ?? 1) * (0.8 + (k % 5) * 0.1)) }).where(eq(schema.activityAssignment.id, h.assignmentId));
  }

  // Comentarios, horario de hoy y evidencias
  await A.addComment(c, "activity", created["Preparar programa de control"], "Interbloqueos listos; falta pantalla de fallas en HMI.");
  await A.addComment(c, "activity", created["Instalar y probar cortina"], "Bloqueada hasta terminar la estructura; el material llegó tarde.");
  await A.updateActivity(c, created["Revisar pendientes del equipo"], { plannedStart: at(today, 8), plannedEnd: at(today, 9) });
  await A.updateActivity(c, created["Preparar reporte semanal de Ingeniería"], { plannedStart: at(today, 11), plannedEnd: at(today, 13) });

  const { execFileSync } = await import("node:child_process");
  const imgDir = path.join(path.dirname(DIR), "demo-img");
  fs.mkdirSync(imgDir, { recursive: true });
  execFileSync("python3", ["-c", `
from PIL import Image, ImageDraw
import sys
specs=[("sensor.png",(48,72,110),"Sensor de presencia"),("estructura.png",(90,98,110),"Estructura cortina"),("escaneo.png",(28,116,194),"Escaneo jig 2")]
for n,col,t in specs:
    im=Image.new("RGB",(640,400),col); d=ImageDraw.Draw(im)
    for i in range(0,640,40): d.line([(i,0),(i,400)],fill=tuple(min(255,x+18) for x in col))
    d.rectangle([180,120,460,280],outline=(255,255,255),width=4); d.text((200,300),t,fill=(255,255,255))
    im.save(sys.argv[1]+"/"+n)
`, imgDir]);
  const up = async (file: string, mime: string, meta: Parameters<typeof EV.uploadEvidence>[2]) =>
    EV.uploadEvidence(c, new File([fs.readFileSync(path.join(imgDir, file))], file, { type: mime }), meta);
  await up("sensor.png", "image/png", { activityId: created["Verificar sensores de presencia"], memberId: juan.id, description: "Sensor de pieza con desgaste" });
  await up("estructura.png", "image/png", { activityId: created["Fabricar estructura"], memberId: pedro.id, description: "Avance de la estructura" });
  await up("escaneo.png", "image/png", { activityId: created["Escanear jig 2 de T/T 57"], memberId: ana.id, description: "Escaneo de referencia" });
  await EV.uploadEvidence(c, new File([Buffer.from("%PDF-1.4\n% Hoja de proceso demo\n")], "hoja-de-proceso.pdf", { type: "application/pdf" }), { projectId: soldadura.id, memberId: ana.id, description: "Hoja de proceso actualizada" });

  // Recordatorios
  await R.createReminders(c, { title: "Revisión de avance: soldadura", kind: "revision", scope: "proyecto", projectId: soldadura.id, eventAt: at(d(2), 9), offsets: ["24h", "0"] });
  await R.createReminders(c, { title: "Seguimiento a Pedro: cortina atrasada", kind: "seguimiento", scope: "equipo", memberId: pedro.id, eventAt: at(today, 7), offsets: ["0"] });
  await R.createReminders(c, { title: "Junta semanal de Ingeniería", kind: "reunion", scope: "personal", eventAt: at(d(1), 10), offsets: ["24h"] });
  await R.syncNotifications(db);

  console.log(`Demo lista en ${DIR}. Usuario: demo@teamcontrol.local / Demo2026segura`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
