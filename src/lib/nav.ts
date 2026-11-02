import {
  Bell, Bot, CalendarDays, ClipboardList, FolderKanban,
  LayoutDashboard, Settings, Sun, UserPlus, Users, type LucideIcon,
} from "lucide-react";

export type NavItem = {
  slug: string; // "" = dashboard
  label: string;
  icon: LucideIcon;
  phase: number;
  ready: boolean;
  summary: string;
  upcoming: string[];
};

/** Secciones visibles (Evidencias, Indicadores y Reportes se retiraron a petición del usuario). `ready` indica si ya está construida; el resto se marca pendiente. */
export const NAV: NavItem[] = [
  { slug: "", label: "Dashboard general", icon: LayoutDashboard, phase: 1, ready: true, summary: "", upcoming: [] },
  { slug: "mi-dia", label: "Mi día", icon: Sun, phase: 2, ready: true,
    summary: "Tu organizador personal del día.",
    upcoming: ["Actividades del día, prioritarias y atrasadas", "Tiempo estimado contra tiempo real", "Avance diario", "Plan del día propuesto por IA (Fase 5)"] },
  { slug: "proyectos", label: "Mis proyectos", icon: FolderKanban, phase: 2, ready: true,
    summary: "Alta, edición, archivo y dashboard de cada proyecto.",
    upcoming: ["Ficha completa con los 8 estados", "Fases y participantes", "Dashboard por proyecto", "Cronograma Gantt"] },
  { slug: "actividades", label: "Gestión de actividades", icon: ClipboardList, phase: 2, ready: true,
    summary: "Todas las actividades con filtros por origen, persona, proyecto y estado.",
    upcoming: ["Lista y vista Kanban", "Checklist interactivo y subtareas", "Registro de horas", "Historial de cambios"] },
  { slug: "equipo", label: "Mi equipo", icon: Users, phase: 3, ready: true,
    summary: "Fichas y perfiles de tus tres colaboradores.",
    upcoming: ["Registro de colaboradores con perfil laboral", "Actividades habituales recurrentes", "Rotación semanal de turnos", "Perfil individual con cumplimiento"] },
  { slug: "asignaciones", label: "Asignaciones", icon: UserPlus, phase: 3, ready: true,
    summary: "Asignar nueva actividad y planificación diaria del equipo.",
    upcoming: ["Formulario «Asignar nueva actividad» a una o varias personas", "Alerta de carga antes de guardar", "Planificación diaria con filtros", "Reprogramación con historial"] },
  { slug: "calendario", label: "Calendario", icon: CalendarDays, phase: 2, ready: true,
    summary: "Vista mensual, semanal y diaria de actividades propias y del equipo.",
    upcoming: ["Vista mes, semana y día", "Filtro por persona y proyecto", "Reprogramar arrastrando"] },
  { slug: "asistente", label: "Asistente IA", icon: Bot, phase: 5, ready: true,
    summary: "Consultas y propuestas en lenguaje natural, siempre con tu aprobación.",
    upcoming: ["Generador de checklist por fases", "Instrucciones de asignación con vista previa", "Respuestas con datos reales: registrado, estimado, recomendación", "Proveedor gratuito (Gemini) configurable"] },
  { slug: "recordatorios", label: "Recordatorios", icon: Bell, phase: 7, ready: true,
    summary: "Alertas personales, de proyecto y de equipo.",
    upcoming: ["Avisos 24 h, 3 días, 7 días o fecha personalizada", "Campana de notificaciones", "Alertas automáticas de vencimiento"] },
  { slug: "configuracion", label: "Configuración", icon: Settings, phase: 4, ready: true,
    summary: "Turnos, factores de ponderación, IA y respaldos.",
    upcoming: ["Horarios de turno de día y de noche", "Factores de prioridad y complejidad", "Umbrales de carga", "Exportación completa de datos"] },
];

export const findNav = (slug: string) => NAV.find((n) => n.slug === slug);
