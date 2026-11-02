import { Badge, type Tone } from "@/components/ui";
import { ORIGIN_LABEL, PRIORITY_LABEL, PROJECT_STATUS_LABEL, STATUS_LABEL } from "@/lib/format";

const STATUS_TONE: Record<string, Tone> = {
  pendiente: "neutral", en_proceso: "sky", en_espera: "warn", bloqueada: "bad", en_revision: "navy", completada: "ok", cancelada: "neutral",
};
const PROJECT_TONE: Record<string, Tone> = {
  no_iniciado: "neutral", en_planificacion: "navy", en_progreso: "sky", en_revision: "navy", en_riesgo: "bad", en_pausa: "warn", completado: "ok", cancelado: "neutral",
};
const ORIGIN_TONE: Record<string, Tone> = { personal: "navy", habitual: "neutral", extraordinaria: "sky" };
const PRIORITY_TONE: Record<string, Tone> = { baja: "neutral", media: "neutral", alta: "warn", critica: "bad" };

export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) return <Badge tone="bad">Vencida</Badge>;
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status] ?? status}</Badge>;
}
export const ProjectStatusBadge = ({ status }: { status: string }) => <Badge tone={PROJECT_TONE[status]}>{PROJECT_STATUS_LABEL[status] ?? status}</Badge>;
export const OriginBadge = ({ origin }: { origin: string }) => <Badge tone={ORIGIN_TONE[origin]}>{ORIGIN_LABEL[origin] ?? origin}</Badge>;
export const PriorityBadge = ({ priority }: { priority: string }) => <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority] ?? priority}</Badge>;

export const LEVEL_TONE: Record<string, Tone> = { baja: "sky", normal: "ok", alta: "warn", sobrecarga: "bad" };
export const LEVEL_TEXT: Record<string, string> = { baja: "Carga baja", normal: "Carga normal", alta: "Carga alta", sobrecarga: "Sobrecarga" };
export function LoadBadge({ level }: { level: string | null }) {
  if (!level) return <Badge>Sin turno configurado</Badge>;
  return <Badge tone={LEVEL_TONE[level]}>{LEVEL_TEXT[level]}</Badge>;
}
