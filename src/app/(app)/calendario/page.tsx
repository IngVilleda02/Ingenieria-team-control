import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { FilterBar, MiniSelect, PageHeader } from "@/components/fields";
import { opts, ORIGIN_LABEL, WEEKDAYS } from "@/lib/format";
import { ctx } from "@/server/context";
import { listAssignments } from "@/server/services/activities";
import { memberOptions } from "@/server/services/members";
import { addDays, todayIn } from "@/server/services/metrics";
import { projectOptions } from "@/server/services/projects";
import { getSetting } from "@/server/services/settings";
import { mondayOf } from "@/server/services/workload";

export const metadata = { title: "Calendario" };
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await ctx("activity.view");
  const today = todayIn(await getSetting("timezone"));
  const week = sp.vista === "semana";
  const anchor = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : today;
  const monthStart = `${anchor.slice(0, 7)}-01`;
  const gridStart = week ? mondayOf(anchor) : mondayOf(monthStart);
  const days = week ? 7 : 42;
  const gridEnd = addDays(gridStart, days - 1);
  const [rows, members, projects] = await Promise.all([
    listAssignments(c, { memberId: sp.persona, projectId: sp.proyecto, origin: sp.origen, from: gridStart, to: gridEnd }),
    memberOptions(c),
    projectOptions(c),
  ]);
  const items = rows.filter((r) => r.status !== "cancelada");
  const byDay = (d: string) => items.filter((r) => (r.dueDate ?? r.startDate) === d);
  const prev = week ? addDays(gridStart, -7) : (() => { const x = new Date(`${monthStart}T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() - 1); return x.toISOString().slice(0, 10); })();
  const next = week ? addDays(gridStart, 7) : (() => { const x = new Date(`${monthStart}T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + 1); return x.toISOString().slice(0, 10); })();
  const link = (p: Record<string, string>) => `?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>), ...p })}`;
  const title = week ? `Semana del ${Number(gridStart.slice(8))} de ${MONTHS[Number(gridStart.slice(5, 7)) - 1].toLowerCase()}` : `${MONTHS[Number(monthStart.slice(5, 7)) - 1]} ${monthStart.slice(0, 4)}`;

  return (
    <>
      <PageHeader icon={CalendarDays} title="Calendario" subtitle="Actividades propias y del equipo por fecha límite" />
      <FilterBar>
        <input type="hidden" name="vista" value={week ? "semana" : "mes"} />
        <input type="hidden" name="fecha" value={anchor} />
        <MiniSelect label="Persona" name="persona" value={sp.persona} options={members.map((m) => ({ value: m.id, label: m.isAdmin ? `${m.name} (yo)` : m.name }))} />
        <MiniSelect label="Proyecto" name="proyecto" value={sp.proyecto} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <MiniSelect label="Tipo" name="origen" value={sp.origen} options={opts(ORIGIN_LABEL)} />
      </FilterBar>

      <div className="my-4 flex flex-wrap items-center gap-2">
        <Link href={link({ fecha: prev })} className="rounded-lg p-2 ring-1 ring-inset ring-line hover:bg-surface" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Link>
        <Link href={link({ fecha: next })} className="rounded-lg p-2 ring-1 ring-inset ring-line hover:bg-surface" aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></Link>
        <Link href={link({ fecha: today })} className="rounded-lg px-3 py-1.5 text-[13px] ring-1 ring-inset ring-line hover:bg-surface">Hoy</Link>
        <h2 className="ml-2 text-base font-semibold text-navy-900">{title}</h2>
        <div className="ml-auto inline-flex rounded-lg border border-line p-0.5 text-[13px]">
          <Link href={link({ vista: "mes" })} className={clsx("rounded-md px-3 py-1", !week ? "bg-navy-800 text-white" : "text-slate-600")}>Mes</Link>
          <Link href={link({ vista: "semana" })} className={clsx("rounded-md px-3 py-1", week ? "bg-navy-800 text-white" : "text-slate-600")}>Semana</Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <div className="grid min-w-[760px] grid-cols-7">
          {WEEKDAYS.map((w) => <div key={w} className="border-b border-line bg-surface/70 px-2 py-1.5 text-2xs font-medium uppercase tracking-wide text-slate-500">{w.slice(0, 3)}</div>)}
          {Array.from({ length: days }, (_, i) => addDays(gridStart, i)).map((d) => {
            const list = byDay(d);
            const out = !week && d.slice(0, 7) !== monthStart.slice(0, 7);
            return (
              <div key={d} className={clsx("group border-b border-r border-line p-1.5", week ? "min-h-[22rem]" : "min-h-[7.5rem]", out && "bg-surface/40")}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={clsx("tabular grid h-6 w-6 place-items-center rounded-full text-xs", d === today ? "bg-navy-800 font-semibold text-white" : out ? "text-slate-400" : "text-navy-900")}>{Number(d.slice(8))}</span>
                  <Link href={`/asignaciones/nueva?fecha=${d}`} className="hidden text-2xs text-slate-400 hover:text-navy-900 group-hover:inline" title="Asignar actividad este día">+</Link>
                </div>
                <div className="space-y-1">
                  {list.slice(0, week ? 30 : 4).map((r) => (
                    <Link
                      key={r.assignmentId}
                      href={`/actividades/${r.activityId}`}
                      title={`${r.title} · ${r.memberName}`}
                      className={clsx(
                        "block truncate rounded px-1.5 py-0.5 text-2xs",
                        r.status === "completada" ? "bg-ok-50 text-ok-700 line-through decoration-ok-700/40" : r.overdue ? "bg-bad-50 text-bad-700" : r.origin === "extraordinaria" ? "bg-sky-50 text-sky-600" : r.origin === "personal" ? "bg-navy-50 text-navy-700" : "bg-surface text-slate-700",
                      )}
                    >
                      {r.memberIsAdmin ? "" : `${r.memberName.split(" ")[0]} · `}{r.title}
                    </Link>
                  ))}
                  {list.length > (week ? 30 : 4) && <Link href={link({ vista: "semana", fecha: d })} className="block text-2xs text-slate-500">+{list.length - 4} más</Link>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-2xs text-slate-500">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-navy-50 ring-1 ring-navy-100" />Personal</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-surface ring-1 ring-line" />Habitual</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-sky-50 ring-1 ring-sky-100" />Extraordinaria</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-ok-50 ring-1 ring-green-200" />Completada</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-bad-50 ring-1 ring-red-200" />Vencida</span>
      </div>
    </>
  );
}
