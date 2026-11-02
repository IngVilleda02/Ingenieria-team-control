import { z } from "zod";

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const zDate = z.string().regex(ISO_DATE, "Fecha no válida.");
export const zOptDate = zDate.nullable().optional();
export const zPriority = z.enum(["baja", "media", "alta", "critica"]);
export const zOrigin = z.enum(["personal", "habitual", "extraordinaria"]);
export const zStatus = z.enum(["pendiente", "en_proceso", "en_espera", "bloqueada", "en_revision", "completada", "cancelada"]);
export const zProjectStatus = z.enum([
  "no_iniciado", "en_planificacion", "en_progreso", "en_revision", "en_riesgo", "en_pausa", "completado", "cancelado",
]);
export const zHours = z.number({ message: "Horas no válidas." }).min(0).max(2000).nullable().optional();
export const zComplexity = z.number().int().min(1).max(5);

export const projectInput = z
  .object({
    name: z.string().min(3, "El nombre necesita al menos 3 caracteres.").max(160),
    description: z.string().max(5000).nullable().optional(),
    objective: z.string().max(2000).nullable().optional(),
    category: z.string().max(80).nullable().optional(),
    ownerMemberId: z.string().uuid().nullable().optional(),
    priority: zPriority.default("media"),
    status: zProjectStatus.default("no_iniciado"),
    startDate: zOptDate,
    dueDate: zOptDate,
    finishedAt: zOptDate,
    budget: z.number().min(0).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    memberIds: z.array(z.string().uuid()).default([]),
  })
  .refine((p) => !p.startDate || !p.dueDate || p.startDate <= p.dueDate, {
    message: "La fecha de fin no puede ser anterior al inicio.",
    path: ["dueDate"],
  });

export const activityInput = z
  .object({
    title: z.string().min(3, "El nombre necesita al menos 3 caracteres.").max(200),
    description: z.string().max(5000).nullable().optional(),
    origin: zOrigin,
    projectId: z.string().uuid().nullable().optional(),
    phaseId: z.string().uuid().nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    routineId: z.string().uuid().nullable().optional(),
    priority: zPriority.default("media"),
    complexity: zComplexity.default(2),
    estimatedH: zHours,
    startDate: zOptDate,
    dueDate: zOptDate,
    evidenceRequired: z.boolean().default(false),
    instructions: z.string().max(5000).nullable().optional(),
    memberIds: z.array(z.string().uuid()).min(1, "Elige al menos un responsable."),
    dependsOn: z.array(z.string().uuid()).default([]),
    checklist: z.array(z.string().min(1).max(300)).default([]),
    plannedStart: z.date().nullable().optional(),
    plannedEnd: z.date().nullable().optional(),
  })
  .refine((a) => !a.startDate || !a.dueDate || a.startDate <= a.dueDate, {
    message: "La fecha límite no puede ser anterior al inicio.",
    path: ["dueDate"],
  });

export type ProjectInput = z.input<typeof projectInput>;
export type ActivityInput = z.input<typeof activityInput>;
