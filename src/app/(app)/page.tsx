import Link from "next/link";
import { CalendarCheck, CalendarClock, FolderKanban, Users } from "lucide-react";
import { CompareChart } from "@/components/charts/CompareChart";
import { Badge, Card, CardHeader, Empty, Progress, type Tone } from "@/components/ui";
import { fmtDate, fmtLongDate, ORIGIN_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/context";
import { getDashboard } from "@/server/services/dashboard";
import { teamIndicators } from "@/server/services/indicators";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const ORIGIN_TONE: Record<string, Tone> = { personal: "navy", habitual: "neutral", extraordinaria: "sky" };
const PRIORITY_TONE: Record<string, Tone> = { baja: "neutral", media: "neutral", alta: "warn", critica: "bad" };

/** Dashboard general: avance de proyectos, actividades de hoy, actividades planeadas y cumplimiento individual. */
export default async function DashboardPage() {
  const c = await ctx("dashboard.view");
  const d = await getDashboard(c.session, c.scope);
  const ti = await teamIndicators(c);
  const firstName = c.session.name.split(" ")[0];

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Actividades de hoy */}
        <Card className="xl:col-span-2">
          <CardHeader title="Actividades de hoy" subtitle="Propias y asignadas al equipo" />
          {d.todayList.length ? (
            <ActivityTable
              rows={d.todayList.map((t) => ({ ...t, date: t.dueDate, overdue: t.overdue }))}
              dateLabel="Límite"
            />
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
                    <Link href={`/proyectos/${p.id}`} className="truncate text-[13px] font-medium text-navy-900 hover:underline">{p.name}</Link>
                    {p.atRisk ? <Badge tone="bad">Requiere atención</Badge> : null}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={p.completion} tone={p.atRisk ? "bad" : "sky"} />
                    <span className="tabular w-14 shrink-0 text-right text-xs text-slate-600">{p.completion == null ? "—" : `${p.completion}%`}</span>
                  </div>
                  <p className="mt-1 text-2xs text-slate-500">{p.activities} actividades · cierre {fmtDate(p.dueDate)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={FolderKanban} title="Sin proyectos activos" text="Crea uno en Mis proyectos o desglósalo con el Asistente IA." />
          )}
        </Card>

        {/* Actividades planeadas */}
        <Card className="xl:col-span-2">
          <CardHeader title="Actividades planeadas" subtitle="Próximos 14 días" />
          {d.planned.length ? (
            <ActivityTable rows={d.planned.map((t) => ({ ...t, date: t.startDate ?? t.dueDate, overdue: false }))} dateLabel="Fecha" />
          ) : (
            <Empty icon={CalendarClock} title="Nada planeado para los próximos días" text="Programa actividades con fecha de inicio o límite para verlas aquí." />
          )}
        </Card>

        {/* Cumplimiento individual */}
        <Card>
          <CardHeader title="Cumplimiento individual" subtitle="Conclusión ponderada por colaborador" />
          {ti.rows.length ? (
            <div className="p-2">
              <CompareChart data={ti.rows.map((r) => ({ name: r.name, habitual: r.habitual.completion, extraordinaria: r.extraordinaria.completion }))} />
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                {ti.rows.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 px-3 py-2 text-xs">
                    <Link href={`/equipo/${r.id}`} className="truncate text-navy-900 hover:underline">{r.name}</Link>
                    <span className="tabular shrink-0 text-slate-600">{r.all.completed} de {r.all.total} completadas</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty icon={Users} title="Sin colaboradores registrados" text="Da de alta a tu equipo en Mi equipo." />
          )}
        </Card>
      </div>
    </>
  );
}

type Row = {
  assignmentId: string; activityId: string; title: string; origin: string; priority: string; status: string;
  memberName: string; isMine: boolean; projectName: string | null; date: string | null; overdue: boolean;
};

function ActivityTable({ rows, dateLabel }: { rows: Row[]; dateLabel: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead className="text-2xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-line">
            <th className="px-4 py-2 font-medium">Actividad</th>
            <th className="px-3 py-2 font-medium">Responsable</th>
            <th className="px-3 py-2 font-medium">Origen</th>
            <th className="px-3 py-2 font-medium">Prioridad</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-4 py-2 text-right font-medium">{dateLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((t) => (
            <tr key={t.assignmentId}>
              <td className="px-4 py-2.5">
                <Link href={`/actividades/${t.activityId}`} className="font-medium text-navy-900 hover:underline">{t.title}</Link>
                {t.projectName && <p className="text-2xs text-slate-500">{t.projectName}</p>}
              </td>
              <td className="px-3 py-2.5 text-slate-600">{t.isMine ? "Yo" : t.memberName}</td>
              <td className="px-3 py-2.5"><Badge tone={ORIGIN_TONE[t.origin]}>{ORIGIN_LABEL[t.origin]}</Badge></td>
              <td className="px-3 py-2.5"><Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge></td>
              <td className="px-3 py-2.5 text-slate-600">{STATUS_LABEL[t.status]}</td>
              <td className={`tabular whitespace-nowrap px-4 py-2.5 text-right ${t.overdue ? "font-medium text-bad-700" : "text-slate-600"}`}>{fmtDate(t.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
