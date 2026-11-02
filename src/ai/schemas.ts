import { z } from "zod";

const prio = z.preprocess((v) => (typeof v === "string" ? v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : v), z.enum(["baja", "media", "alta", "critica"]).catch("media"));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().catch(null);
const hours = z.coerce.number().min(0.25).max(200).catch(2);

export const planActivity = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).nullable().optional().catch(null),
  estimatedH: hours,
  priority: prio,
  complexity: z.coerce.number().int().min(1).max(5).catch(2),
  startDate: date,
  dueDate: date,
  memberName: z.string().max(120).nullable().optional().catch(null),
  memberId: z.string().uuid().nullable().optional().catch(null),
  deliverable: z.string().max(300).nullable().optional().catch(null),
  dependsOn: z.array(z.string()).max(20).optional().catch([]),
});

export const planSchema = z.object({
  objective: z.string().max(1000).catch(""),
  project: z.object({ name: z.string().min(2).max(160), description: z.string().max(3000).nullable().optional().catch(null) }),
  phases: z.array(z.object({ name: z.string().min(1).max(120), activities: z.array(planActivity).min(1).max(40) })).min(1).max(12),
  risks: z.array(z.string().max(300)).max(15).catch([]),
  deliverables: z.array(z.string().max(300)).max(20).catch([]),
});
export type Plan = z.infer<typeof planSchema> & { projectId?: string | null; source: "ia" | "basico" };

export const instructionSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).nullable().optional().catch(null),
  memberNames: z.array(z.string()).max(5).catch([]),
  projectName: z.string().nullable().optional().catch(null),
  dueDate: date,
  startDate: date,
  priority: prio,
  estimatedH: z.coerce.number().min(0.25).max(200).nullable().optional().catch(null),
  origin: z.enum(["habitual", "extraordinaria", "personal"]).catch("extraordinaria"),
});
export type Instruction = z.infer<typeof instructionSchema> & { memberIds: string[]; projectId: string | null; source: "ia" | "basico" };

export const dayPlanSchema = z.object({
  blocks: z
    .array(
      z.object({
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        title: z.string().min(1).max(200),
        activityId: z.string().uuid().nullable().optional().catch(null),
      }),
    )
    .min(1)
    .max(30),
  notes: z.string().max(1000).nullable().optional().catch(null),
});
export type DayPlan = z.infer<typeof dayPlanSchema> & { date: string; source: "ia" | "basico" };

export const chatSchema = z.object({
  answer: z.string().min(1).max(8000),
  proposal: z
    .object({
      type: z.literal("reprogramacion"),
      summary: z.string().max(500).catch(""),
      items: z.array(z.object({ activityId: z.string().uuid(), newDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).min(1).max(100),
    })
    .nullable()
    .optional()
    .catch(null),
});
