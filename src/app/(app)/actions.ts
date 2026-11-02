"use server";

/**
 * Acciones del servidor (POST). Cada una abre un contexto con permiso verificado en el servidor
 * y delega en los servicios, que validan con Zod y registran auditoría.
 */
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import type { ActionState } from "@/components/forms";
import { fdAll, fdBool, fdNum, fdOpt, fdStr } from "@/lib/fd";
import { ctx } from "@/server/context";
import { HttpError } from "@/server/errors";
import type { PermissionCode } from "@/server/permissions";
import * as acts from "@/server/services/activities";
import * as members from "@/server/services/members";
import * as projects from "@/server/services/projects";
import { previewAssignment } from "@/server/services/workload";

function message(e: unknown) {
  if (e instanceof HttpError) return e.message;
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join(" ");
  console.error(e);
  return "Ocurrió un error inesperado.";
}

async function run(perm: PermissionCode, fn: (c: Awaited<ReturnType<typeof ctx>>) => Promise<string | void>, ok?: string): Promise<ActionState> {
  try {
    const c = await ctx(perm);
    const res = await fn(c);
    revalidatePath("/", "layout");
    return { ok: res ?? ok ?? "Guardado." };
  } catch (e) {
    unstable_rethrow(e);
    return { error: message(e) };
  }
}

const num = (fd: FormData, k: string) => {
  const n = fdNum(fd, k);
  if (Number.isNaN(n)) throw new HttpError(422, "Hay un número no válido.");
  return n;
};

// ── Proyectos ────────────────────────────────────────────────────────────────
function projectFromForm(fd: FormData) {
  return {
    name: fdStr(fd, "name"),
    description: fdOpt(fd, "description"),
    objective: fdOpt(fd, "objective"),
    category: fdOpt(fd, "category"),
    ownerMemberId: fdOpt(fd, "ownerMemberId"),
    priority: (fdStr(fd, "priority") || "media") as "media",
    status: (fdStr(fd, "status") || "no_iniciado") as "no_iniciado",
    startDate: fdOpt(fd, "startDate"),
    dueDate: fdOpt(fd, "dueDate"),
    finishedAt: fdOpt(fd, "finishedAt"),
    budget: num(fd, "budget"),
    notes: fdOpt(fd, "notes"),
    memberIds: fdAll(fd, "memberIds"),
  };
}

export async function saveProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = fdOpt(fd, "id");
  let newId: string | null = null;
  const r = await run("project.manage", async (c) => {
    if (id) await projects.updateProject(c, id, projectFromForm(fd));
    else newId = (await projects.createProject(c, projectFromForm(fd))).id;
  });
  if (r.error) return r;
  redirect(`/proyectos/${id ?? newId}`);
}

export async function archiveProjectAction(_: ActionState, fd: FormData) {
  return run("project.manage", (c) => projects.archiveProject(c, fdStr(fd, "id"), fdStr(fd, "archive") === "1"), "Listo.");
}

export async function deleteProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await run("project.manage", (c) => projects.deleteProject(c, fdStr(fd, "id"), fdStr(fd, "confirm")));
  if (r.error) return r;
  redirect("/proyectos");
}

export async function addPhaseAction(_: ActionState, fd: FormData) {
  return run("project.manage", async (c) => void (await projects.addPhase(c, fdStr(fd, "projectId"), fdStr(fd, "name"))), "Fase agregada.");
}

// ── Actividades ──────────────────────────────────────────────────────────────
function activityFromForm(fd: FormData) {
  const checklist = fdStr(fd, "checklist").split("\n").map((l) => l.replace(/^[-*•\s]+/, "").trim()).filter(Boolean);
  return {
    title: fdStr(fd, "title"),
    description: fdOpt(fd, "description"),
    origin: (fdStr(fd, "origin") || "personal") as "personal",
    projectId: fdOpt(fd, "projectId"),
    phaseId: fdOpt(fd, "phaseId"),
    parentId: fdOpt(fd, "parentId"),
    priority: (fdStr(fd, "priority") || "media") as "media",
    complexity: num(fd, "complexity") ?? 2,
    estimatedH: num(fd, "estimatedH"),
    startDate: fdOpt(fd, "startDate"),
    dueDate: fdOpt(fd, "dueDate"),
    evidenceRequired: fdBool(fd, "evidenceRequired"),
    instructions: fdOpt(fd, "instructions"),
    memberIds: fdAll(fd, "memberIds"),
    dependsOn: fdAll(fd, "dependsOn"),
    checklist,
  };
}

/** Crear actividad. Si no se confirmó y alguien queda con carga alta, devuelve la advertencia primero. */
export async function createActivityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let newId: string | null = null;
  let warning: string | null = null;
  const r = await run("activity.manage", async (c) => {
    const input = activityFromForm(fd);
    if (input.origin !== "personal" && !fdBool(fd, "confirmed") && input.memberIds.length) {
      const prev = await previewAssignment(c, input.memberIds, input.estimatedH ?? null, input.dueDate ?? null);
      const w = prev.filter((p) => p.warn).map((p) => p.message).join(" ");
      if (w) {
        warning = w;
        return;
      }
    }
    newId = (await acts.createActivity(c, input)).id;
  });
  if (r.error) return r;
  if (warning) return { error: null, ok: null, data: { warning } };
  const back = fdOpt(fd, "returnTo");
  redirect(back ?? `/actividades/${newId}`);
}

export async function updateActivityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = fdStr(fd, "id");
  const r = await run("activity.manage", (c) => acts.updateActivity(c, id, activityFromForm(fd)));
  if (r.error) return r;
  redirect(`/actividades/${id}`);
}

export async function rescheduleAction(_: ActionState, fd: FormData) {
  return run(
    "activity.manage",
    (c) => acts.updateActivity(c, fdStr(fd, "id"), { dueDate: fdOpt(fd, "dueDate"), ...(fdOpt(fd, "startDate") ? { startDate: fdOpt(fd, "startDate") } : {}) }),
    "Reprogramada. El cambio quedó en el historial.",
  );
}

export async function statusAction(_: ActionState, fd: FormData) {
  return run("activity.progress", (c) => acts.setAssignmentStatus(c, fdStr(fd, "assignmentId"), fdStr(fd, "status"), num(fd, "progressPct")), "Estado actualizado.");
}

/** Para el Kanban (arrastrar y soltar): sin estado previo. */
export async function moveCardAction(assignmentId: string, status: string): Promise<ActionState> {
  return run("activity.progress", (c) => acts.setAssignmentStatus(c, assignmentId, status), "Movida.");
}

export async function timeAction(_: ActionState, fd: FormData) {
  const hours = num(fd, "hours") ?? 0;
  const minutes = num(fd, "minutes") ?? 0;
  return run("activity.progress", (c) => acts.addTimeEntry(c, fdStr(fd, "assignmentId"), hours * 60 + minutes, fdOpt(fd, "note"), fdOpt(fd, "day")), "Horas registradas.");
}

export async function checklistAddAction(_: ActionState, fd: FormData) {
  return run("activity.progress", (c) => acts.addChecklistItem(c, fdStr(fd, "activityId"), fdStr(fd, "text")), "Paso agregado.");
}
export async function checklistToggleAction(itemId: string): Promise<ActionState> {
  return run("activity.progress", (c) => acts.toggleChecklistItem(c, itemId));
}
export async function checklistDeleteAction(_: ActionState, fd: FormData) {
  return run("activity.manage", (c) => acts.deleteChecklistItem(c, fdStr(fd, "itemId")), "Paso eliminado.");
}
export async function commentAction(_: ActionState, fd: FormData) {
  return run("activity.progress", (c) => acts.addComment(c, fdStr(fd, "entityType") === "project" ? "project" : "activity", fdStr(fd, "entityId"), fdStr(fd, "body")), "Comentario agregado.");
}
export async function cancelActivityAction(_: ActionState, fd: FormData) {
  return run("activity.manage", (c) => acts.cancelActivity(c, fdStr(fd, "id")), "Actividad cancelada.");
}
export async function deleteActivityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await run("activity.manage", (c) => acts.deleteActivity(c, fdStr(fd, "id")));
  if (r.error) return r;
  redirect("/actividades");
}

// ── Equipo ───────────────────────────────────────────────────────────────────
function memberFromForm(fd: FormData) {
  return {
    fullName: fdStr(fd, "fullName"),
    internalCode: fdOpt(fd, "internalCode"),
    position: fdOpt(fd, "position"),
    area: fdOpt(fd, "area"),
    specialty: fdOpt(fd, "specialty"),
    responsibilities: fdOpt(fd, "responsibilities"),
    joinedAt: fdOpt(fd, "joinedAt") ?? undefined,
    isActive: fd.has("isActive") ? fdBool(fd, "isActive") : true,
  };
}

export async function saveMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = fdOpt(fd, "id");
  let newId: string | null = null;
  const r = await run("member.manage", async (c) => {
    if (id) await members.updateMember(c, id, memberFromForm(fd));
    else newId = (await members.createMember(c, memberFromForm(fd))).id;
  });
  if (r.error) return r;
  redirect(`/equipo/${id ?? newId}`);
}

export async function addRoutineAction(_: ActionState, fd: FormData) {
  return run(
    "member.manage",
    async (c) => {
      await members.addRoutine(c, fdStr(fd, "memberId"), {
        title: fdStr(fd, "title"),
        description: fdOpt(fd, "description"),
        frequency: fdStr(fd, "frequency") as "diaria",
        weekday: num(fd, "weekday"),
        dayOfMonth: num(fd, "dayOfMonth"),
        estimatedH: num(fd, "estimatedH") ?? 0,
        priority: (fdStr(fd, "priority") || "media") as "media",
        complexity: num(fd, "complexity") ?? 2,
      });
      const n = await members.ensureRoutinesGenerated(c);
      return `Actividad habitual agregada. ${n} instancias generadas para estas dos semanas.`;
    },
  );
}
export async function toggleRoutineAction(_: ActionState, fd: FormData) {
  return run("member.manage", (c) => members.toggleRoutine(c, fdStr(fd, "routineId")), "Actualizada.");
}
export async function rotateShiftsAction(_: ActionState, fd: FormData) {
  return run(
    "member.manage",
    (c) => members.rotateShifts(c, fdStr(fd, "memberId"), fdStr(fd, "weekStart"), fdStr(fd, "first") as "dia", num(fd, "weeks") ?? 8),
    "Rotación de turnos guardada.",
  );
}
export async function setShiftAction(_: ActionState, fd: FormData) {
  return run("member.manage", (c) => members.setShift(c, fdStr(fd, "memberId"), fdStr(fd, "weekStart"), fdStr(fd, "kind") as "dia"), "Turno actualizado.");
}
export async function timeOffAction(_: ActionState, fd: FormData) {
  return run("member.manage", (c) => members.addTimeOff(c, fdStr(fd, "memberId"), fdStr(fd, "dateFrom"), fdStr(fd, "dateTo"), fdOpt(fd, "reason")), "Ausencia registrada.");
}
export async function generateRoutinesAction(_: ActionState) {
  return run("member.manage", async (c) => `${await members.ensureRoutinesGenerated(c)} actividades habituales generadas.`);
}
