import Link from "next/link";
import { Gauge, Info } from "lucide-react";
import { LoadBadge, ProjectStatusBadge } from "@/components/badges";
import { CompareChart } from "@/components/charts/CompareChart";
import { OriginSeriesChart } from "@/components/charts/OriginSeriesChart";
import { FilterBar, Input, PageHeader } from "@/components/fields";
import { IndicatorBlock } from "@/components/IndicatorBlock";
import { Card, CardHeader, Empty, Insufficient } from "@/components/ui";
import { fmtDate, hrs } from "@/lib/format";
import { ctx } from "@/server/context";
import { listAssignments } from "@/server/services/activities";
import { projectProjection, teamIndicators } from "@/server/services/indicators";
import { addDays, todayIn } from "@/server/services/metrics";
import { listProjects } from "@/server/services/projects";
import { getSettings } from "@/server/services/settings";

export const metadata = { title: "Indicadores y eficiencia" };

const v = (x: number | null, suf = "%") => (x == null ? <Insufficient small /> : `${x}${suf}`);

export default async function IndicatorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await ctx("metrics.view");
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const preset = sp.periodo ?? "todo";
  const from = sp.desde || (preset === "semana" ? addDays(today, -7) : preset === "mes" ? addDays(today, -30) : preset === "trimestre" ? addDays(today, -90) : null);
  const to = sp.hasta || null;
  const [ind, projects, rows] = await Promise.all([teamIndicators(c, from, to), listProjects(c), listAssignments(c)]);
  const projRows = projects
    .filter((p) => !["completado", "cancelado"].includes(p.status))
    .map((p) => ({ p, m: projectProjection(p, rows.filter((r) => r.projectId === p.id), s) }));

  return (
    <>
      <PageHeader icon={Gauge} title="Indicadores y eficiencia" subtitle="Ponderados por horas estimadas, prioridad y complejidad" />
      <FilterBar>
        <label className="block">
          <span className="text-2xs font-medium uppercase tracking-wide text-slate-500">Periodo</span>
          <select name="periodo" defaultValue={preset} className="mt-1 block rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px]">
            <option value="todo">Todo</option><option value="semana">Últimos 7 días</option><option value="mes">Últimos 30 días</option><option value="trimestre">Últimos 90 días</option>
          </select>
        </label>
        <label className="block"><span className="text-2xs font-medium uppercase tracking-wide text-slate-500">Desde</span><Input type="date" name="desde" defaultValue={sp.desde} className="!py-1.5" /></label>
        <label className="block"><span className="text-2xs font-medium uppercase tracking-wide text-slate-500">Hasta</span><Input type="date" name="hasta" defaultValue={sp.hasta} className="!py-1.5" /></label>
      </FilterBar>

      <p className="my-4 flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-navy-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Los indicadores describen el trabajo registrado; no miden el valor de una persona. Compara siempre junto con el volumen ponderado y la complejidad. Con menos de {s.min_sample} actividades completadas se muestra «Información insuficiente».
      </p>

      <Card>
        <CardHeader title="Cumplimiento del equipo" subtitle="Habitual y extraordinario por separado" />
        <div className="grid gap-3 p-4 lg:grid-cols-3">
          <IndicatorBlock title="Habituales del equipo" b={ind.team.habitual} tone="navy" />
          <IndicatorBlock title="Extraordinarias del equipo" b={ind.team.extraordinaria} tone="sky" />
          {ind.personal ? <IndicatorBlock title="Mis actividades personales" b={ind.personal} /> : <IndicatorBlock title="Todo el equipo" b={ind.team.all} />}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Comparativa por colaborador" subtitle="Conclusión ponderada: habitual vs. extraordinaria" />
          <div className="p-2">{ind.rows.length ? <CompareChart data={ind.rows.map((r) => ({ name: r.name, habitual: r.habitual.completion, extraordinaria: r.extraordinaria.completion }))} /> : <Empty title="Sin colaboradores registrados" />}</div>
        </Card>
        <Card>
          <CardHeader title="Productividad semanal del equipo" subtitle="Esfuerzo ponderado completado" />
          <div className="p-2"><OriginSeriesChart data={ind.series.weekly} /></div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Tabla comparativa" subtitle="Lee el % junto a su volumen ponderado y su complejidad media" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-2xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Colaborador</th>
                <th className="px-3 py-2 text-right font-medium">Habit. %</th><th className="px-3 py-2 text-right font-medium">Extra. %</th>
                <th className="px-3 py-2 text-right font-medium">A tiempo</th><th className="px-3 py-2 text-right font-medium">Eficiencia</th>
                <th className="px-3 py-2 text-right font-medium">T. prom.</th><th className="px-3 py-2 text-right font-medium">Volumen pond.</th>
                <th className="px-3 py-2 text-right font-medium">Complej.</th><th className="px-3 py-2 text-right font-medium">Vencidas</th><th className="px-4 py-2 font-medium">Carga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ind.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5"><Link href={`/equipo/${r.id}`} className="font-medium text-navy-900 hover:underline">{r.name}</Link></td>
                  <td className="tabular px-3 py-2.5 text-right">{v(r.habitual.completion)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{v(r.extraordinaria.completion)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{v(r.all.onTime)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{v(r.all.efficiency)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{r.all.avgHours == null ? <Insufficient small /> : hrs(r.all.avgHours)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{r.all.weightedDone}/{r.all.weightedVolume}</td>
                  <td className="tabular px-3 py-2.5 text-right">{r.all.avgComplexity ?? "—"}</td>
                  <td className={`tabular px-3 py-2.5 text-right ${r.all.overdue ? "text-bad-700" : ""}`}>{r.all.overdue}</td>
                  <td className="px-4 py-2.5"><LoadBadge level={r.workload.level} /></td>
                </tr>
              ))}
              {ind.rows.length > 0 && (
                <tr className="bg-surface/60 font-medium">
                  <td className="px-4 py-2.5 text-navy-900">Equipo</td>
                  <td className="tabular px-3 py-2.5 text-right">{v(ind.team.habitual.completion)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{v(ind.team.extraordinaria.completion)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{v(ind.team.all.onTime)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{v(ind.team.all.efficiency)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{ind.team.all.avgHours == null ? <Insufficient small /> : hrs(ind.team.all.avgHours)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{ind.team.all.weightedDone}/{ind.team.all.weightedVolume}</td>
                  <td className="tabular px-3 py-2.5 text-right">{ind.team.all.avgComplexity ?? "—"}</td>
                  <td className="tabular px-3 py-2.5 text-right">{ind.team.all.overdue}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Eficiencia de proyectos" subtitle="Avance real contra tiempo transcurrido y fecha proyectada" />
        {projRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-2xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Proyecto</th><th className="px-3 py-2 font-medium">Estado</th><th className="px-3 py-2 text-right font-medium">Avance</th>
                  <th className="px-3 py-2 text-right font-medium">Tiempo</th><th className="px-3 py-2 text-right font-medium">Desviación</th><th className="px-3 py-2 text-right font-medium">Pendientes</th>
                  <th className="px-3 py-2 text-right font-medium">Límite</th><th className="px-4 py-2 text-right font-medium">Cierre proyectado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {projRows.map(({ p, m }) => (
                  <tr key={p.id} className={m.atRisk ? "bg-bad-50/40" : ""}>
                    <td className="px-4 py-2.5"><Link href={`/proyectos/${p.id}`} className="font-medium text-navy-900 hover:underline">{p.name}</Link></td>
                    <td className="px-3 py-2.5"><ProjectStatusBadge status={p.status} /></td>
                    <td className="tabular px-3 py-2.5 text-right">{p.progress == null ? "—" : `${p.progress}%`}</td>
                    <td className="tabular px-3 py-2.5 text-right">{m.elapsedPct == null ? "—" : `${m.elapsedPct}%`}</td>
                    <td className={`tabular px-3 py-2.5 text-right ${m.variance != null && m.variance < 0 ? "text-bad-700" : "text-ok-700"}`}>{m.variance == null ? "—" : `${m.variance > 0 ? "+" : ""}${m.variance}`}</td>
                    <td className="tabular px-3 py-2.5 text-right">{m.pendingCount}{m.overdueCount ? ` (${m.overdueCount} venc.)` : ""}</td>
                    <td className="tabular px-3 py-2.5 text-right">{fmtDate(p.dueDate)}</td>
                    <td className={`tabular px-4 py-2.5 text-right ${m.projectedEnd && p.dueDate && m.projectedEnd > p.dueDate ? "font-medium text-bad-700" : ""}`}>{m.projectedEnd ? fmtDate(m.projectedEnd) : <Insufficient small />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="Sin proyectos activos" />}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Actividades que más tiempo consumen" subtitle="Horas reales registradas" />
        {ind.slowest.length || ind.openHeaviest.length ? (
          <ul className="divide-y divide-line">
            {[...ind.openHeaviest, ...ind.slowest].slice(0, 10).map((a) => (
              <li key={a.assignmentId} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                <Link href={`/actividades/${a.activityId}`} className="min-w-0 flex-1 truncate text-navy-900 hover:underline">{a.title}</Link>
                <span className="text-2xs text-slate-500">{a.memberName}</span>
                <span className="tabular w-28 text-right text-xs">{hrs(a.actualH)} de {hrs(a.estimatedH)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty title="Aún no hay horas registradas" text="Registra horas en cada actividad para medir tiempos." />}
      </Card>
    </>
  );
}
