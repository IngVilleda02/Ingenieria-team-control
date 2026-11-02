/**
 * Esquema completo de INGENIERÍA TEAM CONTROL.
 *
 * Diseñado multiusuario desde el inicio:
 *  - `member` es la ficha de una persona del equipo (incluye al administrador).
 *  - `app_user` es una cuenta que inicia sesión. En la v1 solo existe la del administrador;
 *    habilitar a un colaborador = crear su `app_user` enlazado a su `member`.
 *  - Toda escritura registra `created_by` y deja rastro en `audit_log`.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enumeraciones ────────────────────────────────────────────────────────────
export const activityOrigin = pgEnum("activity_origin", ["personal", "habitual", "extraordinaria"]);
export const priority = pgEnum("priority", ["baja", "media", "alta", "critica"]);
export const assignmentStatus = pgEnum("assignment_status", [
  "pendiente",
  "en_proceso",
  "en_espera",
  "bloqueada",
  "en_revision",
  "completada",
  "cancelada",
]);
export const projectStatus = pgEnum("project_status", [
  "no_iniciado",
  "en_planificacion",
  "en_progreso",
  "en_revision",
  "en_riesgo",
  "en_pausa",
  "completado",
  "cancelado",
]);
export const shiftKind = pgEnum("shift_kind", ["dia", "noche", "descanso"]);
export const frequency = pgEnum("frequency", ["diaria", "semanal", "mensual"]);
export const permissionScope = pgEnum("permission_scope", ["own", "team", "all"]);
export const notificationScope = pgEnum("notification_scope", ["personal", "proyecto", "equipo"]);
export const proposalStatus = pgEnum("proposal_status", ["pendiente", "aprobada", "rechazada"]);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ── Identidad, roles y permisos ──────────────────────────────────────────────
export const role = pgTable("role", {
  id: id(),
  code: text("code").notNull().unique(), // admin | supervisor | colaborador
  name: text("name").notNull(),
  description: text("description"),
});

export const permission = pgTable("permission", {
  id: id(),
  code: text("code").notNull().unique(), // p. ej. activity.assign
  description: text("description").notNull(),
});

export const rolePermission = pgTable(
  "role_permission",
  {
    roleId: uuid("role_id").notNull().references(() => role.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permission.id, { onDelete: "cascade" }),
    scope: permissionScope("scope").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const member = pgTable("member", {
  id: id(),
  fullName: text("full_name").notNull(),
  internalCode: text("internal_code").unique(),
  position: text("position"),
  area: text("area"),
  specialty: text("specialty"),
  responsibilities: text("responsibilities"),
  isAdmin: boolean("is_admin").notNull().default(false),
  supervisorId: uuid("supervisor_id"), // futuro rol Supervisor: a quién reporta
  weeklyCapacityH: numeric("weekly_capacity_h", { precision: 5, scale: 1 }),
  joinedAt: date("joined_at").notNull().default(sql`current_date`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: uuid("created_by"),
});

export const appUser = pgTable("app_user", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roleId: uuid("role_id").notNull().references(() => role.id),
  memberId: uuid("member_id").references(() => member.id),
  isActive: boolean("is_active").notNull().default(true),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Disponibilidad laboral ───────────────────────────────────────────────────
/** Definición de cada turno (horas editables en Configuración). */
export const shiftDefinition = pgTable("shift_definition", {
  kind: shiftKind("kind").primaryKey(),
  startTime: time("start_time").notNull(),
  hours: numeric("hours", { precision: 4, scale: 1 }).notNull(),
  breakMin: integer("break_min").notNull().default(60),
});

/** Días laborables de la semana (1 = lunes … 7 = domingo). */
export const workCalendar = pgTable(
  "work_calendar",
  {
    id: id(),
    memberId: uuid("member_id").references(() => member.id, { onDelete: "cascade" }), // null = regla general
    weekday: integer("weekday").notNull(),
    isWorkday: boolean("is_workday").notNull().default(true),
  },
  (t) => [uniqueIndex("work_calendar_member_day").on(t.memberId, t.weekday)],
);

/** Rotación semanal: qué turno cubre cada persona cada semana. */
export const shiftAssignment = pgTable(
  "shift_assignment",
  {
    id: id(),
    memberId: uuid("member_id").notNull().references(() => member.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(), // lunes de la semana
    kind: shiftKind("kind").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("shift_member_week").on(t.memberId, t.weekStart)],
);

export const timeOff = pgTable("time_off", {
  id: id(),
  memberId: uuid("member_id").notNull().references(() => member.id, { onDelete: "cascade" }),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(),
  reason: text("reason"),
  createdAt: createdAt(),
});

// ── Proyectos ────────────────────────────────────────────────────────────────
export const project = pgTable(
  "project",
  {
    id: id(),
    name: text("name").notNull(),
    description: text("description"),
    objective: text("objective"),
    category: text("category"),
    ownerMemberId: uuid("owner_member_id").references(() => member.id),
    priority: priority("priority").notNull().default("media"),
    status: projectStatus("status").notNull().default("no_iniciado"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    finishedAt: date("finished_at"),
    budget: numeric("budget", { precision: 14, scale: 2 }),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: uuid("created_by"),
  },
  (t) => [index("project_status_idx").on(t.status)],
);

export const projectMember = pgTable(
  "project_member",
  {
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => member.id, { onDelete: "cascade" }),
    roleInProject: text("role_in_project"),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.memberId] })],
);

export const phase = pgTable("phase", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
});

// ── Actividades ──────────────────────────────────────────────────────────────
export const routineTemplate = pgTable("routine_template", {
  id: id(),
  memberId: uuid("member_id").notNull().references(() => member.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  frequency: frequency("frequency").notNull(),
  weekday: integer("weekday"), // para semanal
  dayOfMonth: integer("day_of_month"), // para mensual
  estimatedH: numeric("estimated_h", { precision: 6, scale: 2 }).notNull(),
  priority: priority("priority").notNull().default("media"),
  complexity: integer("complexity").notNull().default(2),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const activity = pgTable(
  "activity",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description"),
    origin: activityOrigin("origin").notNull(),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
    phaseId: uuid("phase_id").references(() => phase.id, { onDelete: "set null" }),
    parentId: uuid("parent_id"), // subtarea
    routineId: uuid("routine_id").references(() => routineTemplate.id, { onDelete: "set null" }),
    priority: priority("priority").notNull().default("media"),
    complexity: integer("complexity").notNull().default(2), // 1–5
    estimatedH: numeric("estimated_h", { precision: 6, scale: 2 }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    plannedStart: timestamp("planned_start", { withTimezone: true }), // horario en Mi día
    plannedEnd: timestamp("planned_end", { withTimezone: true }),
    evidenceRequired: boolean("evidence_required").notNull().default(false),
    instructions: text("instructions"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    createdBy: uuid("created_by"),
  },
  (t) => [
    index("activity_origin_idx").on(t.origin),
    index("activity_project_idx").on(t.projectId),
    index("activity_due_idx").on(t.dueDate),
  ],
);

/** Responsable(s) de una actividad. Cada persona tiene su propio estado, avance y horas. */
export const activityAssignment = pgTable(
  "activity_assignment",
  {
    id: id(),
    activityId: uuid("activity_id").notNull().references(() => activity.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => member.id),
    status: assignmentStatus("status").notNull().default("pendiente"),
    progressPct: integer("progress_pct").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    actualH: numeric("actual_h", { precision: 7, scale: 2 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("assignment_activity_member").on(t.activityId, t.memberId),
    index("assignment_member_idx").on(t.memberId),
    index("assignment_status_idx").on(t.status),
  ],
);

export const activityDependency = pgTable(
  "activity_dependency",
  {
    activityId: uuid("activity_id").notNull().references(() => activity.id, { onDelete: "cascade" }),
    dependsOnId: uuid("depends_on_id").notNull().references(() => activity.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("fin_inicio"),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.dependsOnId] })],
);

export const checklistItem = pgTable("checklist_item", {
  id: id(),
  activityId: uuid("activity_id").notNull().references(() => activity.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  order: integer("order").notNull().default(0),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at", { withTimezone: true }),
});

export const timeEntry = pgTable("time_entry", {
  id: id(),
  assignmentId: uuid("assignment_id").notNull().references(() => activityAssignment.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  minutes: integer("minutes").notNull(),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});

// ── Evidencias, comentarios y comunicación ──────────────────────────────────
export const evidence = pgTable("evidence", {
  id: id(),
  activityId: uuid("activity_id").references(() => activity.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
  memberId: uuid("member_id").references(() => member.id),
  storageKey: text("storage_key").notNull(), // ruta local o URL de Vercel Blob
  originalName: text("original_name").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  description: text("description"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: createdAt(),
  createdBy: uuid("created_by"),
});

/** Preparado para chat interno futuro: un canal por proyecto o conversación directa. */
export const channel = pgTable("channel", {
  id: id(),
  kind: text("kind").notNull(), // proyecto | directo
  projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
  name: text("name"),
  createdAt: createdAt(),
});

export const comment = pgTable(
  "comment",
  {
    id: id(),
    entityType: text("entity_type").notNull(), // activity | project
    entityId: uuid("entity_id").notNull(),
    channelId: uuid("channel_id").references(() => channel.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => appUser.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comment_entity_idx").on(t.entityType, t.entityId)],
);

// ── Recordatorios y notificaciones ───────────────────────────────────────────
export const reminder = pgTable("reminder", {
  id: id(),
  title: text("title").notNull(),
  kind: text("kind").notNull(), // vencimiento | revision | evidencia | seguimiento | reunion | fecha
  scope: notificationScope("scope").notNull(),
  activityId: uuid("activity_id").references(() => activity.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").references(() => member.id, { onDelete: "cascade" }),
  fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
  offsetLabel: text("offset_label"), // 24h | 3d | 7d | personalizado
  firedAt: timestamp("fired_at", { withTimezone: true }),
  createdAt: createdAt(),
  createdBy: uuid("created_by"),
});

export const notification = pgTable("notification", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => appUser.id, { onDelete: "cascade" }),
  scope: notificationScope("scope").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  reminderId: uuid("reminder_id").references(() => reminder.id, { onDelete: "set null" }),
  dedupeKey: text("dedupe_key").unique(), // evita repetir la misma alerta automática
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ── Auditoría e IA ───────────────────────────────────────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    userId: uuid("user_id"),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_at_idx").on(t.at)],
);

export const aiProposal = pgTable("ai_proposal", {
  id: id(),
  kind: text("kind").notNull(), // checklist | asignacion | plan_dia | reprogramacion
  prompt: text("prompt").notNull(),
  payload: jsonb("payload").notNull(),
  status: proposalStatus("status").notNull().default("pendiente"),
  decidedBy: uuid("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: createdAt(),
  createdBy: uuid("created_by"),
});

/** Ajustes editables: factores de ponderación, umbrales de carga, etc. */
export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});
