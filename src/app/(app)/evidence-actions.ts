"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { ActionState } from "@/components/forms";
import { fdOpt, fdStr } from "@/lib/fd";
import { ctx } from "@/server/context";
import { HttpError } from "@/server/errors";
import { deleteEvidence, uploadEvidence } from "@/server/services/evidence";

const msg = (e: unknown) => (e instanceof HttpError ? e.message : e instanceof ZodError ? e.issues[0]?.message ?? "Datos no válidos." : (console.error(e), "No se pudo guardar el archivo."));

export async function uploadEvidenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const c = await ctx("evidence.upload");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "Elige un archivo.");
    await uploadEvidence(c, file, { activityId: fdOpt(fd, "activityId"), projectId: fdOpt(fd, "projectId"), memberId: fdOpt(fd, "memberId"), description: fdOpt(fd, "description") });
    revalidatePath("/", "layout");
    return { ok: "Evidencia guardada." };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function deleteEvidenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const c = await ctx("evidence.view");
    await deleteEvidence(c, fdStr(fd, "id"));
    revalidatePath("/", "layout");
    return { ok: "Evidencia eliminada." };
  } catch (e) {
    return { error: msg(e) };
  }
}
