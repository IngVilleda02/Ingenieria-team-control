import { Insufficient, Progress } from "@/components/ui";
import { hrs } from "@/lib/format";
import type { Block } from "@/server/services/indicators";

/** Bloque de indicadores de un origen. Siempre muestra el contexto (volumen y complejidad) junto al %. */
export function IndicatorBlock({ title, b, tone = "ok" }: { title: string; b: Block; tone?: "ok" | "sky" | "navy" }) {
  const rows: [string, React.ReactNode][] = [
    ["Asignadas", b.total],
    ["Completadas", b.completed],
    ["Pendientes", b.pending],
    ["Vencidas", <span key="v" className={b.overdue ? "font-medium text-bad-700" : ""}>{b.overdue}</span>],
    ["Cumplimiento de fechas", b.onTime == null ? <Insufficient small key="o" /> : `${b.onTime}%`],
    ["Eficiencia de tiempo", b.efficiency == null ? <Insufficient small key="e" /> : `${b.efficiency}%`],
    ["Tiempo promedio", b.avgHours == null ? <Insufficient small key="a" /> : hrs(b.avgHours)],
    ["Horas estimadas / reales", `${hrs(b.estimatedH)} / ${hrs(b.actualH)}`],
    ["Volumen ponderado", `${b.weightedDone} de ${b.weightedVolume} pts`],
    ["Complejidad media", b.avgComplexity ?? "—"],
  ];
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-semibold text-navy-900">{title}</p>
        <p className="tabular text-lg font-semibold text-navy-900">{b.completion == null ? <Insufficient small /> : `${b.completion}%`}</p>
      </div>
      <p className="text-2xs text-slate-500">Conclusión ponderada por esfuerzo</p>
      <div className="mt-2"><Progress value={b.completion} tone={tone === "navy" ? "sky" : tone} /></div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="tabular text-right text-navy-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
