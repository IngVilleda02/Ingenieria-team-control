import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import type { Session } from "../auth";
import type { Scope } from "../permissions";
import {
  addDays,
  CLOSED,
  dateInTz,
  isDueSoon,
  isOverdue,
  onTimeRate,
  remainingHours,
  timeEfficiency,
  todayIn,
  weight,
  weightedCompletion,
  type WorkItem,
} from "./metrics";
import { getSettings } from "./settings";
import { projectProjection } from "./indicators";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

type Row = WorkItem & {
  assignmentId: string;
  activityId: string;
  title: string;
  memberId: string;
  memberName: string;
  memberIsAdmin: boolean;
  projectId: string | null;
  projectName: string | null;
  startDate: string | null;
};

const num = (v: string | null) => (v == null ? null : Number(v));

/**
 * Todo lo que muestra el dashboard se calcula aquí desde la base de datos.
 * `scope` aplica el permiso del usuario: hoy el administrador ve «all».
 */
export async function getDashboard(session: Session, scope: Scope) {
  const db = await getDb();
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayIn(tz);

  const scopeFilter = scope === "own" && session.memberId ? eq(schema.activityAssignment.memberId, session.memberId) : undefined;

  const raw = await db
    .select({
      assignmentId: schema.activityAssignment.id,
      activityId: schema.activity.id,
      title: schema.activity.title,
      origin: schema.activity.origin,
      priority: schema.activity.priority,
      complexity: schema.activity.complexity,
      estimatedH: schema.activity.estimatedH,
      startDate: schema.activity.startDate,
      dueDate: schema.activity.dueDate,
      actualH: schema.activityAssignment.actualH,
      status: schema.activityAssignment.status,
      progressPct: schema.activityAssignment.progressPct,
      finishedAt: schema.activityAssignment.finishedAt,
      memberId: schema.member.id,
      memberName: schema.member.fullName,
      memberIsAdmin: schema.member.isAdmin,
      projectId: schema.project.id,
      projectName: schema.project.name,
    })
    .from(schema.activityAssignment)
    .innerJoin(schema.activity, eq(schema.activity.id, schema.activityAssignment.activityId))
    .innerJoin(schema.member, eq(schema.member.id, schema.activityAssignment.memberId))
    .leftJoin(schema.project, eq(schema.project.id, schema.activity.projectId))
    .where(and(isNull(schema.activity.deletedAt), scopeFilter));

  const rows: Row[] = raw.map((r) => ({ ...r, estimatedH: num(r.estimatedH), actualH: num(r.actualH) }));

  const projects = await db
    .select()
    .from(schema.project)
    .where(and(isNull(schema.project.deletedAt), isNull(schema.project.archivedAt)));

  const members = await db
    .select()
    .from(schema.member)
    .where(and(eq(schema.member.isActive, true), eq(schema.member.isAdmin, false)));

  // ── Indicadores generales ──
  const openProjects = projects.filter((p) => p.status !== "completado" && p.status !== "cancelado");
  const lateProjects = openProjects.filter((p) => p.dueDate && p.dueDate < today);
  const riskProjects = openProjects.filter((p) => p.status === "en_riesgo");
  const open = rows.filter((r) => !CLOSED.includes(r.status));
  const team = rows.filter((r) => !r.memberIsAdmin);
  const todayRows = rows.filter(
    (r) => !CLOSED.includes(r.status) && ((r.dueDate === today) || (r.startDate && r.startDate <= today && (!r.dueDate || r.dueDate >= today))),
  );

  const kpis = {
    projectsActive: openProjects.length,
    projectsCompleted: projects.filter((p) => p.status === "completado").length,
    projectsLate: lateProjects.length,
    activitiesPending: open.length,
    activitiesCompleted: rows.filter((r) => r.status === "completada").length,
    activitiesOverdue: rows.filter((r) => isOverdue(r, today)).length,
    teamAssigned: team.filter((r) => r.status !== "cancelada").length,
    extraordinaryOpen: rows.filter((r) => r.origin === "extraordinaria" && !CLOSED.includes(r.status)).length,
    teamCompletion: weightedCompletion(team, settings),
    teamOnTime: onTimeRate(team, settings, tz),
    efficiency: timeEfficiency(rows, settings),
    today: todayRows.length,
  };

  // ── Productividad: horas ponderadas completadas por día, últimos 14 días ──
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const productivity = days.map((d) => {
    const doneThatDay = rows.filter((r) => r.status === "completada" && r.finishedAt && dateInTz(r.finishedAt, tz) === d);
    return {
      date: d,
      completadas: doneThatDay.length,
      esfuerzo: Math.round(doneThatDay.reduce((s, r) => s + weight(r, settings), 0) * 10) / 10,
    };
  });
  const hasProductivity = productivity.some((p) => p.completadas > 0);

  // ── Avance de proyectos ──
  const projectProgress = openProjects.map((p) => {
    const items = rows.filter((r) => r.projectId === p.id);
    const proj = projectProjection(p, items as never, settings);
    return {
      atRisk: proj.atRisk,
      variance: proj.variance,
      projectedEnd: proj.projectedEnd,
      id: p.id,
      name: p.name,
      status: p.status,
      dueDate: p.dueDate,
      activities: items.length,
      completion: weightedCompletion(items, settings),
    };
  });

  // ── Seguimiento del equipo ──
  const teamCards = members.map((m) => {
    const mine = rows.filter((r) => r.memberId === m.id);
    const pending = mine.filter((r) => !CLOSED.includes(r.status));
    const byDue = (a: Row, b: Row) => (a.dueDate! < b.dueDate! ? -1 : 1);
    const next = pending.filter((r) => r.dueDate && r.dueDate >= today).sort(byDue)[0] ?? pending.filter((r) => r.dueDate).sort(byDue)[0];
    return {
      id: m.id,
      name: m.fullName,
      position: m.position,
      assigned: mine.filter((r) => r.status !== "cancelada").length,
      completed: mine.filter((r) => r.status === "completada").length,
      pending: pending.length,
      overdue: mine.filter((r) => isOverdue(r, today)).length,
      completion: weightedCompletion(mine, settings),
      nextCommitment: next ? { title: next.title, dueDate: next.dueDate } : null,
      pendingHours: remainingHours(mine),
    };
  });

  // ── Actividades de hoy ──
  const todayList = todayRows
    .sort((a, b) => prioRank(b.priority) - prioRank(a.priority))
    .map((r) => ({
      assignmentId: r.assignmentId,
      title: r.title,
      origin: r.origin,
      priority: r.priority,
      status: r.status,
      memberName: r.memberName,
      isMine: r.memberId === session.memberId,
      projectName: r.projectName,
      dueDate: r.dueDate,
      overdue: isOverdue(r, today),
    }));

  // ── Alertas ──
  const alerts: { level: "critica" | "aviso"; kind: string; text: string }[] = [];
  for (const r of rows.filter((r) => isOverdue(r, today)))
    alerts.push({ level: "critica", kind: "Vencida", text: `${r.title} · ${r.memberName} · venció ${r.dueDate}` });
  for (const r of rows.filter((r) => r.status === "bloqueada"))
    alerts.push({ level: "critica", kind: "Bloqueada", text: `${r.title} · ${r.memberName}` });
  for (const p of lateProjects) alerts.push({ level: "critica", kind: "Proyecto atrasado", text: `${p.name} · fecha estimada ${p.dueDate}` });
  for (const p of riskProjects) alerts.push({ level: "aviso", kind: "Proyecto en riesgo", text: p.name });
  for (const p of projectProgress.filter((x) => x.atRisk && x.status !== "en_riesgo" && !lateProjects.some((l) => l.id === x.id)))
    alerts.push({ level: "aviso", kind: "Proyecto requiere atención", text: `${p.name}${p.projectedEnd ? ` · cierre proyectado ${p.projectedEnd}` : ""}${p.variance != null ? ` · ${p.variance} pts vs. plan` : ""}` });
  for (const m of teamCards.filter((m) => m.overdue > 0)) alerts.push({ level: "aviso", kind: "Colaborador con pendientes vencidos", text: `${m.name} · ${m.overdue} vencidas de ${m.pending} pendientes` });
  for (const r of rows.filter((r) => isDueSoon(r, today, settings.due_soon_days)))
    alerts.push({ level: "aviso", kind: "Próxima a vencer", text: `${r.title} · ${r.memberName} · ${r.dueDate}` });

  return {
    today,
    kpis,
    productivity,
    hasProductivity,
    projectProgress,
    teamCards,
    todayList,
    alerts,
    counts: { members: members.length, projects: projects.length, activities: rows.length },
  };
}

const prioRank = (p: string) => ({ baja: 0, media: 1, alta: 2, critica: 3 })[p] ?? 0;
