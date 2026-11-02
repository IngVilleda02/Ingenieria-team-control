/**
 * Servicios de IA. Regla de oro: la IA solo LEE y PROPONE. Cada propuesta se guarda en ai_proposal
 * como «pendiente» y solo se ejecuta cuando el administrador la aprueba, a través de los mismos
 * servicios que usan los formularios (con permisos y auditoría).
 * Sin clave de IA, el generador y el plan del día usan un desglose básico local, marcado como tal.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { schema } from "@/db/client";
import { aiStatus, AiError, chatJson } from "@/ai/provider";
import { chatSchema, dayPlanSchema, instructionSchema, planSchema, type DayPlan, type Instruction, type Plan } from "@/ai/schemas";
import { audit } from "../audit";
import type { Ctx } from "../context";
import { HttpError } from "../errors";
import { createActivity, listAssignments, rescheduleMany, updateActivity } from "./activities";
import { memberOptions } from "./members";
import { addDays, CLOSED, todayIn } from "./metrics";
import { addPhase, createProject, listProjects, projectOptions } from "./projects";
import { getSettings } from "./settings";
import { teamIndicators } from "./indicators";
import { memberWorkload } from "./workload";

const P = schema.aiProposal;

async function saveProposal(c: Ctx, kind: string, prompt: string, payload: unknown, status: "pendiente" | "aprobada" = "pendiente") {
  const [p] = await c.db.insert(P).values({ kind, prompt: prompt.slice(0, 8000), payload: payload as object, status, createdBy: c.session.userId }).returning();
  return p;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
function matchMember(name: string | null | undefined, members: { id: string; name: string }[]) {
  if (!name) return null;
  const n = norm(name);
  return members.find((m) => norm(m.name) === n) ?? members.find((m) => norm(m.name).split(/\s+/).includes(n.split(/\s+/)[0])) ?? null;
}

// ── 1. Generador de actividades / checklist ─────────────────────────────────
const PLAN_SYSTEM = (today: string, team: string) => `Eres un planificador de proyectos de ingeniería de manufactura.
Responde SOLO un objeto JSON con esta forma:
{"objective": string, "project": {"name": string, "description": string},
 "phases": [{"name": string, "activities": [{"title": string, "description": string, "estimatedH": number,
   "priority": "baja"|"media"|"alta"|"critica", "complexity": 1-5, "startDate": "YYYY-MM-DD", "dueDate": "YYYY-MM-DD",
   "memberName": string|null, "deliverable": string|null, "dependsOn": [títulos de actividades previas]}]}],
 "risks": [string], "deliverables": [string]}
Reglas: organiza en fases lógicas (p. ej. Diagnóstico, Desarrollo, Validación); usa verbos en infinitivo; horas realistas;
fechas en días hábiles (lunes a viernes) a partir de ${today}; propone responsable solo entre: ${team || "(sin colaboradores; usa null)"}.
Escribe en español de México.`;

export async function proposePlan(c: Ctx, text: string, projectId?: string | null) {
  if (text.trim().length < 15) throw new HttpError(422, "Describe el trabajo con un poco más de detalle.");
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const members = (await memberOptions(c)).filter((m) => !m.isAdmin);
  let plan: Plan;
  if (aiStatus().configured) {
    const raw = await chatJson(PLAN_SYSTEM(today, members.map((m) => m.name).join(", ")), text);
    const parsed = planSchema.safeParse(raw);
    if (!parsed.success) throw new AiError("La IA devolvió un plan incompleto. Intenta de nuevo o reformula.");
    plan = { ...parsed.data, source: "ia" };
  } else {
    plan = basicPlan(text, today);
  }
  for (const ph of plan.phases) for (const a of ph.activities) a.memberId = matchMember(a.memberName, members)?.id ?? null;
  plan.projectId = projectId ?? null;
  return saveProposal(c, "checklist", text, plan);
}

/** Desglose local sin IA: separa los pasos del texto y los agrupa por tipo de verbo. */
export function basicPlan(text: string, today: string): Plan {
  const parts = text
    .replace(/\n+/g, ". ")
    .split(/[.;]|,\s*(?=[a-záéíóúñ])|\s+(?:y luego|luego|después|despues|posteriormente|finalmente|primero|y)\s+(?=[a-záéíóúñ]+(?:r|ar|er|ir)\b)/i)
    .map((s) => {
      let t = s.trim();
      for (let prev = ""; prev !== t; ) {
        prev = t;
        t = t.replace(/^(?:necesito|tengo que|debo|hay que|primero|primeramente|despu[eé]s|luego|posteriormente|finalmente|por [uú]ltimo|tambi[eé]n|y|e)\s+/i, "").trim();
      }
      return t;
    })
    .filter((s) => s.length > 3);
  const first = parts.shift() ?? text.slice(0, 80);
  const groups: Record<string, string[]> = { Diagnóstico: [], Desarrollo: [], Validación: [] };
  const diag = /^(revis|verific|identific|analiz|diagnostic|medir|evalu|inspeccion|levant)/i;
  const val = /^(prob|valid|document|liber|entreg|report|capacit|cerrar)/i;
  for (const p of parts.length ? parts : [first]) {
    const cap = p.charAt(0).toUpperCase() + p.slice(1);
    (diag.test(p) ? groups.Diagnóstico : val.test(p) ? groups.Validación : groups.Desarrollo).push(cap);
  }
  const isWeekend = (d: string) => [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay());
  const nextWork = (d: string) => {
    let x = addDays(d, 1);
    while (isWeekend(x)) x = addDays(x, 1);
    return x;
  };
  let day = isWeekend(today) ? nextWork(today) : today;
  const phases = Object.entries(groups)
    .filter(([, v]) => v.length)
    .map(([name, acts]) => ({
      name,
      activities: acts.map((title) => {
        const startDate = day;
        day = nextWork(day);
        return { title: title.slice(0, 200), description: null, estimatedH: 2, priority: "media" as const, complexity: 2, startDate, dueDate: startDate, memberName: null, memberId: null, deliverable: null, dependsOn: [] as string[] };
      }),
    }));
  const name = first.length > 60 ? `${first.slice(0, 57)}…` : first;
  return { objective: first, project: { name: name.charAt(0).toUpperCase() + name.slice(1), description: text.slice(0, 3000) }, phases, risks: [], deliverables: [], source: "basico" };
}

/** Aprueba el plan (con los cambios hechos en la vista previa) y crea proyecto, fases y actividades. */
export async function approvePlan(
  c: Ctx,
  proposalId: string,
  edits: { include: boolean; title: string; memberId: string | null; dueDate: string | null; startDate: string | null; estimatedH: number | null }[],
  projectName?: string | null,
) {
  const prop = await pending(c, proposalId, "checklist");
  const plan = prop.payload as Plan;
  const flat = plan.phases.flatMap((ph) => ph.activities.map((a) => ({ phase: ph.name, a })));
  if (edits.length !== flat.length) throw new HttpError(422, "La propuesta cambió; recárgala.");
  if (!edits.some((e) => e.include)) throw new HttpError(422, "Selecciona al menos una actividad.");
  let projectId = plan.projectId ?? null;
  if (!projectId) {
    const p = await createProject(c, { name: projectName?.trim() || plan.project.name, description: plan.project.description, objective: plan.objective, status: "en_planificacion", startDate: flat.find((f) => f.a.startDate)?.a.startDate ?? null, dueDate: edits.filter((e) => e.include).map((e) => e.dueDate).filter(Boolean).sort().at(-1) ?? null, notes: plan.risks.length ? `Riesgos detectados por IA:\n- ${plan.risks.join("\n- ")}` : null });
    projectId = p.id;
  }
  const phaseIds = new Map<string, string>();
  const existing = await c.db.select().from(schema.phase).where(eq(schema.phase.projectId, projectId));
  for (const ph of plan.phases) {
    const found = existing.find((e) => norm(e.name) === norm(ph.name));
    phaseIds.set(ph.name, found?.id ?? (await addPhase(c, projectId, ph.name)).id);
  }
  const created = new Map<string, string>();
  for (let i = 0; i < flat.length; i++) {
    const e = edits[i];
    if (!e.include) continue;
    const { phase, a } = flat[i];
    const deps = (a.dependsOn ?? []).map((t) => created.get(norm(t))).filter(Boolean) as string[];
    const mine = !e.memberId;
    const act = await createActivity(c, {
      title: e.title || a.title,
      description: [a.description, a.deliverable ? `Entregable: ${a.deliverable}` : null].filter(Boolean).join("\n") || null,
      origin: mine ? "personal" : "extraordinaria",
      projectId,
      phaseId: phaseIds.get(phase),
      priority: a.priority,
      complexity: a.complexity,
      estimatedH: e.estimatedH ?? a.estimatedH,
      startDate: e.startDate && e.dueDate && e.startDate > e.dueDate ? e.dueDate : e.startDate,
      dueDate: e.dueDate,
      memberIds: mine ? [c.session.memberId!] : [e.memberId!],
      dependsOn: deps,
    });
    created.set(norm(a.title), act.id);
  }
  await decide(c, proposalId, "aprobada");
  return projectId;
}

// ── 2. Instrucciones en lenguaje natural ────────────────────────────────────
const INSTR_SYSTEM = (today: string, team: string, projects: string) => `Convierte la instrucción en una actividad. Hoy es ${today} (zona America/Mexico_City).
Responde SOLO JSON: {"title": string, "description": string|null, "memberNames": [string], "projectName": string|null,
"dueDate": "YYYY-MM-DD"|null, "startDate": "YYYY-MM-DD"|null, "priority": "baja"|"media"|"alta"|"critica", "estimatedH": number|null,
"origin": "extraordinaria"|"habitual"|"personal"}.
Colaboradores válidos: ${team || "(ninguno)"}. Proyectos válidos: ${projects || "(ninguno)"}. Si no se menciona persona, memberNames = [] y origin = "personal".
"mañana" = día siguiente; si no se dice prioridad usa "media".`;

export async function proposeInstruction(c: Ctx, text: string) {
  if (text.trim().length < 8) throw new HttpError(422, "Escribe la instrucción completa.");
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const members = (await memberOptions(c)).filter((m) => !m.isAdmin);
  const projects = await projectOptions(c);
  let ins: Omit<Instruction, "memberIds" | "projectId" | "source">;
  let source: "ia" | "basico" = "ia";
  if (aiStatus().configured) {
    const parsed = instructionSchema.safeParse(await chatJson(INSTR_SYSTEM(today, members.map((m) => m.name).join(", "), projects.map((p) => p.name).join(" | ")), text));
    if (!parsed.success) throw new AiError("No se pudo interpretar la instrucción.");
    ins = parsed.data;
  } else {
    source = "basico";
    ins = basicInstruction(text, today, members, projects);
  }
  const memberIds = ins.memberNames.map((n) => matchMember(n, members)?.id).filter(Boolean) as string[];
  const project = ins.projectName ? projects.find((p) => norm(p.name) === norm(ins.projectName!)) ?? projects.find((p) => norm(p.name).includes(norm(ins.projectName!))) : null;
  const payload: Instruction = { ...ins, memberIds, projectId: project?.id ?? null, origin: memberIds.length ? (ins.origin === "personal" ? "extraordinaria" : ins.origin) : "personal", source };
  return saveProposal(c, "asignacion", text, payload);
}

export function basicInstruction(text: string, today: string, members: { id: string; name: string }[], projects: { id: string; name: string }[]) {
  const t = norm(text);
  const words = new Set(t.split(/[^a-z0-9]+/));
  const memberNames = members.filter((m) => words.has(norm(m.name).split(/\s+/)[0])).map((m) => m.name);
  const project = projects.find((p) => t.includes(norm(p.name)));
  let dueDate: string | null = null;
  if (/pasado manana/.test(t)) dueDate = addDays(today, 2);
  else if (/manana/.test(t)) dueDate = addDays(today, 1);
  else if (/\bhoy\b/.test(t)) dueDate = today;
  else if (/proxima semana|siguiente semana/.test(t)) dueDate = addDays(today, 7);
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) dueDate = iso[0];
  const priority = /urgente|critic/.test(t) ? "critica" : /alta|prioridad alta|importante/.test(t) ? "alta" : /baja/.test(t) ? "baja" : "media";
  const m = text.match(/(?:agrega|agregar|crea|crear|asigna|asignar)\s+(?:una\s+)?(?:actividad|tarea)\s+(?:para\s+)?(.+?)(?:\s+y\s+as[ií]gna|\s+a\s+\w+\s+para|\s+para\s+(?:ma[ñn]ana|hoy)|$)/i);
  const title = (m?.[1] ?? text).replace(/[.]$/, "").trim();
  return { title: title.charAt(0).toUpperCase() + title.slice(1, 200), description: null, memberNames, projectName: project?.name ?? null, dueDate, startDate: dueDate ? today : null, priority: priority as "media", estimatedH: null, origin: (memberNames.length ? "extraordinaria" : "personal") as "extraordinaria" };
}

// ── 3. Planificación de Mi día ───────────────────────────────────────────────
export async function proposeDayPlan(c: Ctx, text: string) {
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const mine = (await listAssignments(c, { memberId: c.session.memberId! })).filter((a) => !CLOSED.includes(a.status) && (!a.dueDate || a.dueDate <= addDays(today, 3)));
  const wl = await memberWorkload(c, c.session.memberId!);
  const [def] = await c.db.select().from(schema.shiftDefinition).where(eq(schema.shiftDefinition.kind, wl.shiftThisWeek === "noche" ? "noche" : "dia"));
  const startTime = def?.startTime?.slice(0, 5) ?? "08:00";
  const hours = def ? Number(def.hours) : 9;
  let plan: Omit<DayPlan, "date" | "source">;
  let source: "ia" | "basico" = "ia";
  if (aiStatus().configured) {
    const ctxText = JSON.stringify(mine.slice(0, 40).map((a) => ({ activityId: a.activityId, title: a.title, priority: a.priority, dueDate: a.dueDate, estimatedH: a.estimatedH, progressPct: a.progressPct })));
    const sys = `Organiza el día de trabajo. Turno de ${startTime}, ${hours} h con 1 h de descanso. Responde SOLO JSON {"blocks":[{"start":"HH:MM","end":"HH:MM","title":string,"activityId":uuid|null}],"notes":string|null}.
Usa activityId cuando el bloque corresponda a una de estas actividades existentes: ${ctxText}. Prioriza vencidas y críticas. No excedas el turno. Incluye un bloque de descanso.`;
    const parsed = dayPlanSchema.safeParse(await chatJson(sys, text || "Organiza mis actividades pendientes de hoy."));
    if (!parsed.success) throw new AiError("La IA devolvió un plan no válido.");
    const ids = new Set(mine.map((m) => m.activityId));
    plan = { ...parsed.data, blocks: parsed.data.blocks.map((b) => ({ ...b, activityId: b.activityId && ids.has(b.activityId) ? b.activityId : null })) };
  } else {
    source = "basico";
    plan = basicDayPlan(text, mine, startTime);
  }
  return saveProposal(c, "plan_dia", text || "(organizar pendientes)", { ...plan, date: today, source } satisfies DayPlan);
}

function basicDayPlan(text: string, mine: { activityId: string; title: string; priority: string; estimatedH: number | null; overdue: boolean }[], start: string) {
  const asked = text
    .split(/,|;|\.|\s+y\s+/i)
    .map((s) => s.replace(/^(hoy\s+)?(necesito|tengo que|debo)\s+/i, "").trim())
    .filter((s) => s.length > 3);
  const rank = (p: string) => ({ critica: 0, alta: 1, media: 2, baja: 3 })[p] ?? 2;
  const existing = [...mine].sort((a, b) => Number(b.overdue) - Number(a.overdue) || rank(a.priority) - rank(b.priority));
  const items: { title: string; activityId: string | null; h: number }[] = [
    ...asked.map((t) => {
      const hit = existing.find((e) => norm(e.title).includes(norm(t).slice(0, 18)) || norm(t).includes(norm(e.title).slice(0, 18)));
      return { title: hit?.title ?? t.charAt(0).toUpperCase() + t.slice(1), activityId: hit?.activityId ?? null, h: Math.min(hit?.estimatedH ?? 1.5, 3) };
    }),
    ...existing.filter((e) => !asked.length).map((e) => ({ title: e.title, activityId: e.activityId, h: Math.min(e.estimatedH ?? 1, 3) })),
  ];
  let [h, m] = start.split(":").map(Number);
  let mins = h * 60 + m;
  const fmt = (x: number) => `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  const blocks: { start: string; end: string; title: string; activityId: string | null }[] = [];
  let worked = 0;
  for (const it of items.slice(0, 10)) {
    if (worked >= 240 && !blocks.some((b) => b.title === "Descanso")) {
      blocks.push({ start: fmt(mins), end: fmt(mins + 60), title: "Descanso", activityId: null });
      mins += 60;
    }
    const d = Math.round(it.h * 60 / 15) * 15 || 60;
    blocks.push({ start: fmt(mins), end: fmt(mins + d), title: it.title, activityId: it.activityId });
    mins += d;
    worked += d;
  }
  if (!blocks.length) blocks.push({ start: fmt(mins), end: fmt(mins + 60), title: "Revisar pendientes", activityId: null });
  return { blocks, notes: "Distribución básica sin IA: orden por vencidas y prioridad." };
}

export async function approveDayPlan(c: Ctx, proposalId: string, include: boolean[]) {
  const prop = await pending(c, proposalId, "plan_dia");
  const plan = prop.payload as DayPlan;
  const tzOffset = "-06:00";
  for (let i = 0; i < plan.blocks.length; i++) {
    const b = plan.blocks[i];
    if (!include[i] || b.title === "Descanso") continue;
    const plannedStart = new Date(`${plan.date}T${b.start}:00${tzOffset}`);
    let plannedEnd = new Date(`${plan.date}T${b.end}:00${tzOffset}`);
    if (plannedEnd <= plannedStart) plannedEnd = new Date(plannedEnd.getTime() + 864e5);
    if (b.activityId) await updateActivity(c, b.activityId, { plannedStart, plannedEnd });
    else
      await createActivity(c, {
        title: b.title,
        origin: "personal",
        startDate: plan.date,
        dueDate: plan.date,
        estimatedH: Math.round(((plannedEnd.getTime() - plannedStart.getTime()) / 36e5) * 100) / 100,
        plannedStart,
        plannedEnd,
        memberIds: [c.session.memberId!],
      });
  }
  await decide(c, proposalId, "aprobada");
}

// ── 4. Asistente conversacional ──────────────────────────────────────────────
export async function askAssistant(c: Ctx, question: string) {
  if (question.trim().length < 3) throw new HttpError(422, "Escribe tu pregunta.");
  if (!aiStatus().configured) throw new AiError("IA no configurada. El asistente necesita AI_API_KEY (gratuita en aistudio.google.com).");
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const rows = await listAssignments(c);
  const projects = await listProjects(c);
  const ind = await teamIndicators(c);
  const context = {
    hoy: today,
    yo: c.session.name,
    colaboradores: ind.rows.map((r) => ({ nombre: r.name, habitual: pick(r.habitual), extraordinaria: pick(r.extraordinaria), carga: { nivel: r.workload.level, pendientesH: r.workload.pendingH, disponiblesH: r.workload.availableH } })),
    proyectos: projects.map((p) => ({ nombre: p.name, estado: p.status, avancePct: p.progress, limite: p.dueDate, atrasado: p.late, abiertas: p.openCount, vencidas: p.overdueCount })),
    actividades: rows
      .filter((r) => r.status !== "cancelada")
      .slice(0, 250)
      .map((r) => ({ activityId: r.activityId, titulo: r.title, responsable: r.memberIsAdmin ? `${r.memberName} (yo)` : r.memberName, tipo: r.origin, estado: r.status, vencida: r.overdue, inicio: r.startDate, limite: r.dueDate, asignada: r.assignedAt.toISOString().slice(0, 10), estimadoH: r.estimatedH, realH: r.actualH, avance: r.progressPct, proyecto: r.projectName })),
  };
  const sys = `Eres el asistente de gestión de un ingeniero que administra su trabajo y el de su equipo. Responde en español de México, breve y concreto.
Usa SOLO los datos del contexto; si algo no está, dilo. Marca cada afirmación con una etiqueta: **[Registrado]** (dato de la base), **[Estimado]** (cálculo tuyo a partir de los datos) o **[Recomendación]** (tu sugerencia).
Si el usuario pide reprogramar o mover fechas, NO digas que ya lo hiciste: devuelve una propuesta para su aprobación.
Responde SOLO JSON: {"answer": "markdown", "proposal": null | {"type":"reprogramacion","summary": string, "items":[{"activityId": uuid del contexto, "newDueDate":"YYYY-MM-DD"}]}}.
CONTEXTO: ${JSON.stringify(context)}`;
  const parsed = chatSchema.safeParse(await chatJson(sys, question, { temperature: 0.1 }));
  if (!parsed.success) throw new AiError("La IA respondió en un formato no válido. Intenta de nuevo.");
  const known = new Map(rows.map((r) => [r.activityId, r]));
  let proposalId: string | null = null;
  if (parsed.data.proposal) {
    const items = parsed.data.proposal.items.filter((i) => known.has(i.activityId)).map((i) => ({ activityId: i.activityId, title: known.get(i.activityId)!.title, from: known.get(i.activityId)!.dueDate, to: i.newDueDate }));
    if (items.length) proposalId = (await saveProposal(c, "reprogramacion", question, { summary: parsed.data.proposal.summary, items })).id;
  }
  await saveProposal(c, "chat", question, { answer: parsed.data.answer, proposalId }, "aprobada");
  return { answer: parsed.data.answer, proposalId };
}

function pick(b: { total: number; completed: number; pending: number; overdue: number; completion: number | null; onTime: number | null; efficiency: number | null }) {
  return { total: b.total, completadas: b.completed, pendientes: b.pending, vencidas: b.overdue, conclusionPonderadaPct: b.completion, aTiempoPct: b.onTime, eficienciaPct: b.efficiency };
}

export async function approveReschedule(c: Ctx, proposalId: string, include: boolean[]) {
  const prop = await pending(c, proposalId, "reprogramacion");
  const items = (prop.payload as { items: { activityId: string; to: string }[] }).items.filter((_, i) => include[i]);
  await rescheduleMany(c, items.map((i) => ({ activityId: i.activityId, dueDate: i.to })));
  await decide(c, proposalId, "aprobada");
}

// ── Comunes ──────────────────────────────────────────────────────────────────
async function pending(c: Ctx, id: string, kind: string) {
  if (c.scope === "own") throw new HttpError(403, "Sin permiso.");
  const [p] = await c.db.select().from(P).where(and(eq(P.id, id), eq(P.kind, kind)));
  if (!p) throw new HttpError(404, "Propuesta no encontrada.");
  if (p.status !== "pendiente") throw new HttpError(409, "Esta propuesta ya fue decidida.");
  return p;
}

export async function decide(c: Ctx, id: string, status: "aprobada" | "rechazada") {
  await c.db.transaction(async (tx) => {
    await tx.update(P).set({ status, decidedBy: c.session.userId, decidedAt: new Date() }).where(and(eq(P.id, id), eq(P.status, "pendiente")));
    await audit(tx, { userId: c.session.userId, entityType: "ai_proposal", entityId: id, action: status === "aprobada" ? "ai_approve" : "ai_reject" });
  });
}

export async function getProposal(c: Ctx, id: string) {
  const [p] = await c.db.select().from(P).where(eq(P.id, id));
  if (!p) throw new HttpError(404, "Propuesta no encontrada.");
  return p;
}

export async function recentProposals(c: Ctx, kinds: string[], limit = 20) {
  return c.db.select().from(P).where(inArray(P.kind, kinds)).orderBy(desc(P.createdAt)).limit(limit);
}

export async function markInstructionUsed(c: Ctx, id: string) {
  await pending(c, id, "asignacion");
  await decide(c, id, "aprobada");
}
