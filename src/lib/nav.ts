import {
  Bell, Bot, CalendarDays, ClipboardList, FileBarChart, FolderKanban, Gauge,
  LayoutDashboard, Paperclip, Settings, Sun, UserPlus, Users, type LucideIcon,
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

/** Las 13 secciones aprobadas. `ready` indica si ya está construida; el resto se marca pendiente. */
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
  { slug: "evidencias", label: "Evidencias", icon: Paperclip, phase: 6, ready: true,
    summary: "Repositorio central de archivos y bitácora cronológica.",
    upcoming: ["Fotos, PDF, Excel, Word y archivos de programación", "Relación con proyecto, actividad y responsable", "Línea de tiempo por proyecto y persona"] },
  { slug: "recordatorios", label: "Recordatorios", icon: Bell, phase: 7, ready: true,
    summary: "Alertas personales, de proyecto y de equipo.",
    upcoming: ["Avisos 24 h, 3 días, 7 días o fecha personalizada", "Campana de notificaciones", "Alertas automáticas de vencimiento"] },
  { slug: "indicadores", label: "Indicadores y eficiencia", icon: Gauge, phase: 4, ready: true,
    summary: "Cumplimiento, eficiencia, carga de trabajo y comparativas justas.",
    upcoming: ["Cumplimiento habitual y extraordinario por separado", "Carga de trabajo por turno", "Comparativas ponderadas por esfuerzo", "Fecha proyectada de cierre de proyectos"] },
  { slug: "reportes", label: "Reportes", icon: FileBarChart, phase: 6, ready: true,
    summary: "Reportes individuales y generales en PDF y Excel.",
    upcoming: ["Diario, semanal, mensual o por periodo", "Por proyecto y por colaborador"] },
  { slug: "configuracion", label: "Configuración", icon: Settings, phase: 4, ready: true,
    summary: "Turnos, factores de ponderación, IA y respaldos.",
    upcoming: ["Horarios de turno de día y de noche", "Factores de prioridad y complejidad", "Umbrales de carga", "Exportación completa de datos"] },
];

export const findNav = (slug: string) => NAV.find((n) => n.slug === slug);
