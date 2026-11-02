"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AiError } from "@/ai/provider";
import type { ActionState } from "@/components/forms";
import { fdAll, fdBool, fdNum, fdOpt, fdStr } from "@/lib/fd";
import { ctx } from "@/server/context";
import { HttpError } from "@/server/errors";
import type { PermissionCode } from "@/server/permissions";
import * as ai from "@/server/services/ai";
import { restoreAll } from "@/server/services/backup";
import * as rem from "@/server/services/reminders";
import { saveSettings, saveShiftDefinitions } from "@/server/services/settings";
import { createUserForMember } from "@/server/services/users";

function message(e: unknown) {
  if (e instanceof HttpError || e instanceof AiError) return e.message;
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ");
  console.error(e);
  return "Ocurrió un error inesperado.";
}
async function run(perm: PermissionCode, fn: (c: Awaited<ReturnType<typeof ctx>>) => Promise<string | void>, ok = "Guardado."): Promise<ActionState> {
  try {
    const c = await ctx(perm);
    const r = await fn(c);
    revalidatePath("/", "layout");
    return { ok: r ?? ok };
  } catch (e) {
    unstable_rethrow(e);
    return { error: message(e) };
  }
}
const n = (fd: FormData, k: string, d = 0) => {
  const v = fdNum(fd, k);
  return v == null || Number.isNaN(v) ? d : v;
};

// ── IA ───────────────────────────────────────────────────────────────────────
export async function proposePlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | null = null;
  const r = await run("ai.use", async (c) => void (id = (await ai.proposePlan(c, fdStr(fd, "text"), fdOpt(fd, "projectId"))).id));
  if (r.error) return r;
  redirect(`/asistente/propuesta/${id}`);
}
export async function proposeInstructionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | null = null;
  const r = await run("ai.use", async (c) => void (id = (await ai.proposeInstruction(c, fdStr(fd, "text"))).id));
  if (r.error) return r;
  redirect(`/asistente/propuesta/${id}`);
}
export async function proposeDayPlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | null = null;
  const r = await run("ai.use", async (c) => void (id = (await ai.proposeDayPlan(c, fdStr(fd, "text"))).id));
  if (r.error) return r;
  redirect(`/asistente/propuesta/${id}`);
}
export async function askAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const c = await ctx("ai.use");
    const res = await ai.askAssistant(c, fdStr(fd, "question"));
    revalidatePath("/asistente");
    return { ok: null, data: res };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function approvePlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let pid: string | null = null;
  const count = n(fd, "count");
  const edits = Array.from({ length: count }, (_, i) => ({
    include: fdBool(fd, `inc_${i}`),
    title: fdStr(fd, `title_${i}`),
    memberId: fdOpt(fd, `member_${i}`),
    startDate: fdOpt(fd, `start_${i}`),
    dueDate: fdOpt(fd, `due_${i}`),
    estimatedH: fdNum(fd, `est_${i}`),
  }));
  const r = await run("activity.assign", async (c) => void (pid = await ai.approvePlan(c, fdStr(fd, "proposalId"), edits, fdOpt(fd, "projectName"))));
  if (r.error) return r;
  redirect(`/proyectos/${pid}`);
}
export async function approveDayPlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const include = Array.from({ length: n(fd, "count") }, (_, i) => fdBool(fd, `inc_${i}`));
  const r = await run("activity.manage", (c) => ai.approveDayPlan(c, fdStr(fd, "proposalId"), include));
  if (r.error) return r;
  redirect("/mi-dia");
}
export async function approveRescheduleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const include = Array.from({ length: n(fd, "count") }, (_, i) => fdBool(fd, `inc_${i}`));
  const r = await run("activity.manage", (c) => ai.approveReschedule(c, fdStr(fd, "proposalId"), include));
  if (r.error) return r;
  redirect("/asignaciones");
}
export async function useInstructionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = fdStr(fd, "proposalId");
  const r = await run("activity.assign", (c) => ai.markInstructionUsed(c, id));
  if (r.error) return r;
  redirect(`/asignaciones/nueva?propuesta=${id}`);
}
export async function rejectProposalAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await run("ai.use", (c) => ai.decide(c, fdStr(fd, "proposalId"), "rechazada"), "Propuesta rechazada. No se modificó nada.");
  if (r.error) return r;
  redirect("/asistente");
}

// ── Recordatorios y notificaciones ───────────────────────────────────────────
export async function createReminderAction(_: ActionState, fd: FormData) {
  return run(
    "activity.view",
    async (c) => {
      const date = fdStr(fd, "eventDate");
      const time = fdStr(fd, "eventTime") || "08:00";
      const custom = fdOpt(fd, "customAt");
      await rem.createReminders(c, {
        title: fdStr(fd, "title"),
        kind: fdStr(fd, "kind"),
        scope: fdStr(fd, "scope") as "personal",
        activityId: fdOpt(fd, "activityId"),
        projectId: fdOpt(fd, "projectId"),
        memberId: fdOpt(fd, "memberId"),
        eventAt: new Date(`${date}T${time}:00-06:00`),
        offsets: fdAll(fd, "offsets") as ("24h")[],
        customAt: custom ? new Date(`${custom}:00-06:00`) : null,
      });
    },
    "Recordatorio creado.",
  );
}
export async function deleteReminderAction(_: ActionState, fd: FormData) {
  return run("activity.view", (c) => rem.deleteReminder(c, fdStr(fd, "id")), "Recordatorio eliminado.");
}
export async function markReadAction(_: ActionState, fd: FormData) {
  return run("dashboard.view", (c) => rem.markRead(c, fdStr(fd, "id") ? [fdStr(fd, "id")] : "all"), "Listo.");
}

// ── Configuración ────────────────────────────────────────────────────────────
export async function saveSettingsAction(_: ActionState, fd: FormData) {
  return run(
    "settings.manage",
    async (c) => {
      await saveShiftDefinitions(
        c,
        [
          { kind: "dia", startTime: fdStr(fd, "dia_start"), hours: n(fd, "dia_hours"), breakMin: n(fd, "dia_break") },
          { kind: "noche", startTime: fdStr(fd, "noche_start"), hours: n(fd, "noche_hours"), breakMin: n(fd, "noche_break") },
        ],
        fdAll(fd, "workdays").map(Number),
      );
      await saveSettings(c, {
        priority_factor: { baja: n(fd, "pf_baja"), media: n(fd, "pf_media"), alta: n(fd, "pf_alta"), critica: n(fd, "pf_critica") },
        complexity_factor: { "1": n(fd, "cf_1"), "2": n(fd, "cf_2"), "3": n(fd, "cf_3"), "4": n(fd, "cf_4"), "5": n(fd, "cf_5") },
        workload_thresholds: { normal: n(fd, "wt_normal") / 100, alta: n(fd, "wt_alta") / 100, sobrecarga: n(fd, "wt_sobrecarga") / 100 },
        due_soon_days: n(fd, "due_soon_days"),
        min_sample: n(fd, "min_sample"),
        efficiency_cap: n(fd, "efficiency_cap"),
      });
    },
    "Configuración guardada. Los indicadores ya usan los nuevos valores.",
  );
}

export async function restoreAction(_: ActionState, fd: FormData) {
  return run(
    "settings.manage",
    async (c) => {
      const f = fd.get("file");
      if (!(f instanceof File) || !f.size) throw new HttpError(422, "Elige el archivo de respaldo.");
      if (f.size > 50 * 1024 * 1024) throw new HttpError(422, "El respaldo es demasiado grande.");
      let dump: unknown;
      try {
        dump = JSON.parse(await f.text());
      } catch {
        throw new HttpError(422, "El archivo no es JSON válido.");
      }
      await restoreAll(c, dump, fdStr(fd, "confirm"));
    },
    "Respaldo restaurado. Vuelve a iniciar sesión si cambiaron las cuentas.",
  );
}

export async function createUserAction(_: ActionState, fd: FormData) {
  return run(
    "user.manage",
    async (c) => void (await createUserForMember(c, { memberId: fdStr(fd, "memberId"), email: fdStr(fd, "email"), role: fdStr(fd, "role") as "colaborador", password: fdStr(fd, "password") })),
    "Cuenta creada.",
  );
}
