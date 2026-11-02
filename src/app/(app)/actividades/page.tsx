import Link from "next/link";
import clsx from "clsx";
import { ClipboardList, Columns3, List, Plus } from "lucide-react";
import { Kanban } from "@/components/Kanban";
import { OriginBadge, PriorityBadge, StatusBadge } from "@/components/badges";
import { FilterBar, Input, LinkButton, MiniSelect, PageHeader } from "@/components/fields";
import { Card, Empty } from "@/components/ui";
import { fmtDate, hrs, opts, ORIGIN_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/context";
import { listAssignments } from "@/server/services/activities";
import { memberOptions } from "@/server/services/members";
import { projectOptions } from "@/server/services/projects";

export const metadata = { title: "Actividades" };
type SP = Promise<Record<string, string | undefined>>;

export default async function ActivitiesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const c = await ctx("activity.view");
  const view = sp.vista === "kanban" ? "kanban" : "lista";
  const [rows, members, projects] = await Promise.all([
    listAssignments(c, { origin: sp.origen, memberId: sp.persona, projectId: sp.proyecto, status: sp.estado ?? (view === "kanban" ? undefined : "abiertas"), priority: sp.prioridad, q: sp.q }),
    memberOptions(c),
    projectOptions(c),
  ]);
  const qs = (v: string) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, x]) => x) as [string, string][]);
    p.set("vista", v);
    return `?${p}`;
  };
  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title="Gestión de actividades"
        subtitle={`${rows.length} asignaciones con los filtros actuales`}
        actions={
          <>
            <LinkButton href="/actividades/nueva" variant="soft"><Plus className="h-4 w-4" />Actividad personal</LinkButton>
            <LinkButton href="/asignaciones/nueva"><Plus className="h-4 w-4" />Asignar nueva actividad</LinkButton>
          </>
        }
      />
      <FilterBar>
        <input type="hidden" name="vista" value={view} />
        <label className="block min-w-[180px] flex-1">
          <span className="text-2xs font-medium uppercase tracking-wide text-slate-500">Buscar</span>
          <Input name="q" defaultValue={sp.q} placeholder="Nombre de la actividad" className="!mt-1 !py-1.5" />
        </label>
        <MiniSelect label="Tipo" name="origen" value={sp.origen} options={opts(ORIGIN_LABEL)} />
        <MiniSelect label="Persona" name="persona" value={sp.persona} options={members.map((m) => ({ value: m.id, label: m.isAdmin ? `${m.name} (yo)` : m.name }))} />
        <MiniSelect label="Proyecto" name="proyecto" value={sp.proyecto} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <MiniSelect label="Estado" name="estado" value={sp.estado} options={[{ value: "abiertas", label: "Abiertas" }, { value: "vencida", label: "Vencidas" }, ...opts(STATUS_LABEL)]} />
        <MiniSelect label="Prioridad" name="prioridad" value={sp.prioridad} options={opts(PRIORITY_LABEL)} />
      </FilterBar>

      <div className="my-4 inline-flex rounded-lg border border-line p-0.5 text-[13px]">
        <Link href={qs("lista")} className={clsx("flex items-center gap-1.5 rounded-md px-3 py-1.5", view === "lista" ? "bg-navy-800 text-white" : "text-slate-600")}><List className="h-4 w-4" />Lista</Link>
        <Link href={qs("kanban")} className={clsx("flex items-center gap-1.5 rounded-md px-3 py-1.5", view === "kanban" ? "bg-navy-800 text-white" : "text-slate-600")}><Columns3 className="h-4 w-4" />Kanban</Link>
      </div>

      {view === "kanban" ? (
        <Kanban cards={rows.filter((r) => r.status !== "cancelada")} />
      ) : (
        <Card>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-2xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-medium">Actividad</th>
                    <th className="px-3 py-2 font-medium">Responsable</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Prioridad</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 text-right font-medium">Avance</th>
                    <th className="px-3 py-2 text-right font-medium">Est. / real</th>
                    <th className="px-4 py-2 text-right font-medium">Límite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.assignmentId} className="hover:bg-surface/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/actividades/${r.activityId}`} className="font-medium text-navy-900 hover:underline">{r.title}</Link>
                        {r.projectName && <p className="text-2xs text-slate-500">{r.projectName}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{r.memberIsAdmin ? "Yo" : r.memberName}</td>
                      <td className="px-3 py-2.5"><OriginBadge origin={r.origin} /></td>
                      <td className="px-3 py-2.5"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} overdue={r.overdue} /></td>
                      <td className="tabular px-3 py-2.5 text-right text-slate-600">{r.progressPct}%</td>
                      <td className="tabular px-3 py-2.5 text-right text-slate-600">{hrs(r.estimatedH)} / {hrs(r.actualH)}</td>
                      <td className={`tabular px-4 py-2.5 text-right ${r.overdue ? "font-medium text-bad-700" : "text-slate-600"}`}>{fmtDate(r.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={ClipboardList} title="No hay actividades con estos filtros" text="Crea una actividad personal o asigna una a tu equipo." />
          )}
        </Card>
      )}
    </>
  );
}
