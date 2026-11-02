export const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente", en_proceso: "En proceso", en_espera: "En espera", bloqueada: "Bloqueada",
  en_revision: "En revisión", completada: "Completada", cancelada: "Cancelada",
};
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  no_iniciado: "No iniciado", en_planificacion: "En planificación", en_progreso: "En progreso", en_revision: "En revisión",
  en_riesgo: "En riesgo", en_pausa: "En pausa", completado: "Completado", cancelado: "Cancelado",
};
export const PRIORITY_LABEL: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta", critica: "Crítica" };
export const ORIGIN_LABEL: Record<string, string> = { personal: "Personal", habitual: "Habitual", extraordinaria: "Extraordinaria" };

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}
export function fmtLongDate(iso: string) {
  const s = fmtDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export const pct = (v: number | null) => (v == null ? null : `${v.toLocaleString("es-MX", { maximumFractionDigits: 1 })} %`);

export const opts = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));
export const SHIFT_LABEL: Record<string, string> = { dia: "Día", noche: "Noche", descanso: "Descanso" };
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const hrs = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString("es-MX", { maximumFractionDigits: 1 })} h`);
export function fmtDateTime(d: Date | string | null | undefined, tz = "America/Mexico_City") {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d));
}
export function fmtTime(d: Date | string | null | undefined, tz = "America/Mexico_City") {
  if (!d) return "";
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(d));
}
export const ACTION_LABEL: Record<string, string> = {
  create: "Creó", assign: "Asignó", reassign: "Cambió responsables", update: "Editó", reschedule: "Reprogramó", priority: "Cambió prioridad",
  start: "Inició", finish: "Terminó", status: "Cambió estado", time: "Registró horas", checklist_add: "Agregó paso", checklist_done: "Marcó paso",
  checklist_undo: "Desmarcó paso", checklist_remove: "Quitó paso", comment: "Comentó", cancel: "Canceló", delete: "Eliminó", archive: "Archivó",
  unarchive: "Restauró", phase_add: "Agregó fase", evidence: "Subió evidencia", evidence_delete: "Eliminó evidencia", setup: "Configuró el sistema",
  routine_add: "Agregó actividad habitual", routine_pause: "Pausó actividad habitual", routine_resume: "Reactivó actividad habitual",
  shift: "Asignó turno", time_off: "Registró ausencia", ai_approve: "Aprobó propuesta de IA", ai_reject: "Rechazó propuesta de IA",
  settings: "Cambió configuración", restore: "Restauró respaldo", user_create: "Creó cuenta", reminder: "Creó recordatorio",
};
