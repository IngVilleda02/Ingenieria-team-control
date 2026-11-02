import Link from "next/link";
import {
  AlertTriangle, BarChart3, CalendarCheck, CheckCircle2, Clock, FolderKanban, ListTodo, Sparkles, Users,
} from "lucide-react";
import { ProductivityChart } from "@/components/charts/ProductivityChart";
import { CompareChart } from "@/components/charts/CompareChart";
import { OriginSeriesChart } from "@/components/charts/OriginSeriesChart";
import { teamIndicators } from "@/server/services/indicators";
import { Badge, Card, CardHeader, Empty, Insufficient, Kpi, Progress, type Tone } from "@/components/ui";
import { fmtDate, fmtLongDate, ORIGIN_LABEL, pct, PRIORITY_LABEL, PROJECT_STATUS_LABEL, STATUS_LABEL } from "@/lib/format";
import { LoadBadge } from "@/components/badges";
import { ctx } from "@/server/context";
import { getDashboard } from "@/server/services/dashboard";
import { memberWorkload } from "@/server/services/workload";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const ORIGIN_TONE: Record<string, Tone> = { personal: "navy", habitual: "neutral", extraordinaria: "sky" };
const PRIORITY_TONE: Record<string, Tone> = { baja: "neutral", media: "neutral", alta: "warn", critica: "bad" };

export default async function DashboardPage() {
  const c = await ctx("dashboard.view");
  const { session, scope } = c;
  const d = await getDashboard(session, scope);
  const ti = await teamIndicators(c);
  const loads = new Map(await Promise.all(d.teamCards.map(async (m) => [m.id, await memberWorkload(c, m.id)] as const)));
  const k = d.kpis;
  const firstName = session.name.split(" ")[0];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{fmtLongDate(d.today)}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-navy-900">Hola, {firstName}</h1>
        </div>
        <p className="text-xs text-slate-500">
          {d.counts.projects} proyectos · {d.counts.activities} asignaciones · {d.counts.members} colaboradores
        </p>
      </header>

      {/* Indicadores generales */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Proyectos activos" value={k.projectsActive} icon={FolderKanban} hint={`${k.projectsCompleted} completados`} />
        <Kpi label="Proyectos atrasados" value={k.projectsLate} icon={AlertTriangle} tone={k.projectsLate ? "bad" : "navy"} />
        <Kpi label="Pendientes" value={k.activitiesPending} icon={ListTodo} hint={`${k.activitiesCompleted} completadas`} />
        <Kpi label="Vencidas" value={k.activitiesOverdue} icon={Clock} tone={k.activitiesOverdue ? "bad" : "navy"} />
        <Kpi label="Programadas hoy" value={k.today} icon={CalendarCheck} tone="sky" />
        <Kpi label="Extraordinarias abiertas" value={k.extraordinaryOpen} icon={Sparkles} tone="sky" hint={`${k.teamAssigned} asignadas al equipo`} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Cumplimiento del equipo (ponderado)" value={pct(k.teamCompletion) ?? <Insufficient />} tone="ok" />
        <Kpi label="Entregas a tiempo" value={pct(k.teamOnTime) ?? <Insufficient />} tone="ok" />
        <Kpi label="Eficiencia de tiempo" value={pct(k.efficiency) ?? <Insufficient />} tone="sky" hint="Estimado ÷ real, completadas con horas" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Productividad */}
        <Card className="xl:col-span-2">
          <CardHeader title="Productividad" subtitle="Esfuerzo ponderado completado por día, últimos 14 días" />
          <div className="px-2 py-3">
            {d.hasProductivity ? (
              <ProductivityChart data={d.productivity} />
            ) : (
              <Empty icon={BarChart3} title="Aún no hay actividades completadas" text="La gráfica se llena sola cuando se cierren actividades." />
            )}
          </div>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader title="Alertas" subtitle="Detectadas automáticamente" action={d.alerts.length ? <Badge tone="bad">{d.alerts.length}</Badge> : null} />
          {d.alerts.length ? (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {d.alerts.slice(0, 30).map((a, i) => (
                <li key={i} className="flex gap-2.5 px-4 py-2.5">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.level === "critica" ? "bg-bad-600" : "bg-warn-500"}`} />
                  <div className="min-w-0">
                    <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">{a.kind}</p>
                    <p className="truncate text-[13px] text-navy-900" title={a.text}>{a.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={CheckCircle2} title="Sin alertas" text="No hay actividades vencidas, bloqueadas ni proyectos en riesgo." />
          )}
        </Card>

        {/* Semanal y por persona */}
        <Card>
          <CardHeader title="Productividad semanal" subtitle="Habitual y extraordinaria, últimas 8 semanas" />
          <div className="p-2"><OriginSeriesChart data={ti.series.weekly} /></div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Cumplimiento individual" subtitle="Conclusión ponderada por colaborador · completadas por persona" />
          {ti.rows.length ? (
            <div className="grid gap-2 p-2 md:grid-cols-[1fr_220px]">
              <CompareChart data={ti.rows.map((r) => ({ name: r.name, habitual: r.habitual.completion, extraordinaria: r.extraordinaria.completion }))} />
              <ul className="divide-y divide-line self-center rounded-lg border border-line">
                {ti.rows.map((r) => (
                  <li key={r.id} className="flex justify-between px-3 py-2 text-xs"><span className="text-navy-900">{r.name}</span><span className="tabular text-slate-600">{r.all.completed} completadas</span></li>
                ))}
              </ul>
            </div>
          ) : <Empty icon={Users} title="Sin colaboradores registrados" />}
        </Card>

        {/* Actividades de hoy */}
        <Card className="xl:col-span-2">
          <CardHeader title="Actividades de hoy" subtitle="Propias y asignadas al equipo" />
          {d.todayList.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-2xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-medium">Actividad</th>
                    <th className="px-3 py-2 font-medium">Responsable</th>
                    <th className="px-3 py-2 font-medium">Origen</th>
                    <th className="px-3 py-2 font-medium">Prioridad</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 text-right font-medium">Límite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.todayList.map((t) => (
                    <tr key={t.assignmentId}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-navy-900">{t.title}</p>
                        {t.projectName && <p className="text-2xs text-slate-500">{t.projectName}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{t.isMine ? "Yo" : t.memberName}</td>
                      <td className="px-3 py-2.5"><Badge tone={ORIGIN_TONE[t.origin]}>{ORIGIN_LABEL[t.origin]}</Badge></td>
                      <td className="px-3 py-2.5"><Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge></td>
                      <td className="px-3 py-2.5 text-slate-600">{STATUS_LABEL[t.status]}</td>
                      <td className={`tabular px-4 py-2.5 text-right ${t.overdue ? "font-medium text-bad-700" : "text-slate-600"}`}>{fmtDate(t.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={CalendarCheck} title="Nada programado para hoy" text="Las actividades aparecerán aquí al crearlas en Mi día o en Asignaciones." />
          )}
        </Card>

        {/* Avance de proyectos */}
        <Card>
          <CardHeader title="Avance de proyectos" subtitle="Ponderado por esfuerzo" />
          {d.projectProgress.length ? (
            <ul className="divide-y divide-line">
              {d.projectProgress.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-medium text-navy-900">{p.name}</p>
                    <Badge tone={p.status === "en_riesgo" ? "bad" : "navy"}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={p.completion} tone={p.status === "en_riesgo" ? "bad" : "sky"} />
                    <span className="tabular w-14 shrink-0 text-right text-xs text-slate-600">{p.completion == null ? "—" : `${p.completion}%`}</span>
                  </div>
                  <p className="mt-1 text-2xs text-slate-500">{p.activities} actividades · cierre {fmtDate(p.dueDate)}{p.variance != null ? ` · ${p.variance > 0 ? "+" : ""}${p.variance} pts vs. plan` : ""}{p.atRisk ? " · requiere atención" : ""}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={FolderKanban} title="Sin proyectos activos" text="Crea uno en Mis proyectos o desglósalo con el Asistente IA." />
          )}
        </Card>
      </div>

      {/* Seguimiento del equipo */}
      <Card className="mt-4">
        <CardHeader title="Seguimiento del equipo" subtitle="Una tarjeta por colaborador" />
        {d.teamCards.length ? (
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
            {d.teamCards.map((m) => (
              <div key={m.id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-navy-900">{m.name}</p><LoadBadge level={loads.get(m.id)?.level ?? null} /></div>
                <p className="text-2xs text-slate-500">{m.position ?? "Sin puesto"}</p>
                <dl className="tabular mt-3 grid grid-cols-4 gap-2 text-center">
                  {[["Asignadas", m.assigned, ""], ["Hechas", m.completed, "text-ok-700"], ["Pendientes", m.pending, ""], ["Vencidas", m.overdue, m.overdue ? "text-bad-700" : ""]].map(([l, v, c]) => (
                    <div key={l as string}>
                      <dd className={`text-lg font-semibold text-navy-900 ${c}`}>{v}</dd>
                      <dt className="text-2xs text-slate-500">{l}</dt>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={m.completion} tone="ok" />
                  <span className="shrink-0 text-xs">{m.completion == null ? <Insufficient small /> : `${m.completion}%`}</span>
                </div>
                <p className="mt-3 text-2xs text-slate-500">
                  Próximo: {m.nextCommitment ? `${m.nextCommitment.title} · ${fmtDate(m.nextCommitment.dueDate)}` : "—"}
                </p>
                <p className="mt-1 text-2xs text-slate-500">{loads.get(m.id)?.pendingH ?? m.pendingHours} h pendientes de {loads.get(m.id)?.availableH ?? "—"} h disponibles (5 días hábiles)</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={Users}
            title="Aún no hay colaboradores registrados"
            text="Da de alta a tus tres colaboradores con su perfil laboral y turno."
            action={<Link href="/equipo" className="text-xs font-medium text-sky-600 hover:underline">Ir a Mi equipo</Link>}
          />
        )}
      </Card>
    </>
  );
}
