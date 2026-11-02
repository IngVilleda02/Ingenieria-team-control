/**
 * Catálogo de permisos y su alcance por rol.
 * El backend es la única autoridad: cada ruta llama a `requirePermission`.
 * Ocultar un botón en la interfaz nunca sustituye esta verificación.
 */
export type Scope = "own" | "team" | "all";
export type RoleCode = "admin" | "supervisor" | "colaborador";

export const PERMISSIONS = {
  "dashboard.view": "Ver el dashboard",
  "project.view": "Ver proyectos",
  "project.manage": "Crear, editar y archivar proyectos",
  "activity.view": "Ver actividades",
  "activity.manage": "Crear y editar actividades",
  "activity.assign": "Asignar actividades a otras personas",
  "activity.progress": "Actualizar avance y registrar horas",
  "evidence.upload": "Subir evidencias",
  "evidence.view": "Ver evidencias",
  "metrics.view": "Consultar indicadores",
  "member.manage": "Administrar fichas del equipo",
  "user.manage": "Administrar usuarios y permisos",
  "settings.manage": "Cambiar la configuración",
  "ai.use": "Usar el asistente de IA",
  "audit.view": "Consultar la bitácora",
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as PermissionCode[];

/** Matriz aprobada en el documento de diseño. */
export const ROLE_MATRIX: Record<RoleCode, Partial<Record<PermissionCode, Scope>>> = {
  admin: Object.fromEntries(ALL.map((p) => [p, "all"])) as Record<PermissionCode, Scope>,
  supervisor: {
    "dashboard.view": "team",
    "project.view": "team",
    "project.manage": "team",
    "activity.view": "team",
    "activity.manage": "team",
    "activity.assign": "team",
    "activity.progress": "team",
    "evidence.upload": "team",
    "evidence.view": "team",
    "metrics.view": "team",
    "ai.use": "team",
    "audit.view": "team",
  },
  colaborador: {
    "dashboard.view": "own",
    "project.view": "own",
    "activity.view": "own",
    "activity.progress": "own",
    "evidence.upload": "own",
    "evidence.view": "own",
    "metrics.view": "own",
  },
};

export const ROLE_NAMES: Record<RoleCode, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  colaborador: "Colaborador",
};

export function scopeFor(role: RoleCode, perm: PermissionCode): Scope | null {
  return ROLE_MATRIX[role][perm] ?? null;
}
