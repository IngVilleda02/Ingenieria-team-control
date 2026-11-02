import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, List, Plus, UserPlus } from "lucide-react";
import { rescheduleAction } from "@/app/(app)/actions";
import { LoadBadge, OriginBadge, PriorityBadge, StatusBadge } from "@/components/badges";
import { ActionForm, Submit } from "@/components/forms";
import { FilterBar, Input, LinkButton, MiniSelect, PageHeader } from "@/components/fields";
import { Kanban } from "@/components/Kanban";
import { Card, Empty } from "@/components/ui";
import { fmtDate, fmtLongDate, hrs, opts, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/context";
import { listAssignments } from "@/server/services/activities";
import { ensureRoutinesGenerated, listMembers } from "@/server/services/members";
import { addDays, todayIn } from "@/server/services/metrics";
import { projectOptions } from "@/server/services/projects";
import { getSetting } from "@/server/services/settings";
import { memberWorkload } from "@/server/services/workload";

export const metadata = { title: "Planificación diaria" };

export default async function DailyPlanning({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await ctx("activity.view");
  await ensureRoutinesGenerated(c);
  const today = todayIn(await getSetting("timezone"));
  const day = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : today;
  const view = sp.vista === "kanban" ? "kanban" : "tabla";
  const [members, projects] = await Promise.all([listMembers(c), projectOptions(c)]);
  const all = await listAssignments(c, { memberId: sp.persona, projectId: sp.proyecto, priority: sp.prioridad, status: sp.estado, origin: sp.tipo });
  // Lo que cada persona debe hacer ese día: lo programado ese día + lo vencido sin cerrar
  const rows = all.filter(
    (r) =>
      !r.memberIsAdmin &&
      r.status !== "cancelada" &&
      (r.dueDate === day || (r.startDate && r.startDate <= day && r.dueDate && r.dueDate >= day) || (!r.dueDate && r.startDate === day) || (day === today && r.overdue)),
  );
  const loads = await Promise.all(members.map((m) => memberWorkload(c, m.id)));
  const link = (p: Record<string, string>) => `?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>), ...p })}`;

  return (
    <>
      <PageHeader
        icon={UserPlus}
        title="Planificación diaria"
        subtitle="Qué debe realizar cada persona"
        actions={
          <>
            <LinkButton href="/calendario" variant="soft"><CalendarDays className="h-4 w-4" />Calendario</LinkButton>
            <LinkButton href={`/asignaciones/nueva?fecha=${day}`}><Plus className="h-4 w-4" />Asignar nueva actividad</LinkButton>
          </>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {members.map((m, i) => (
          <Link key={m.id} href={`/equipo/${m.id}`}>
            <Card className="flex items-center justify-between gap-2 px-4 py-3 hover:shadow-sm">
              <div>
                <p className="text-[13px] font-semibold text-navy-900">{m.fullName}</p>
                <p className="text-2xs text-slate-500">{hrs(loads[i].pendingH)} pendientes · {hrs(loads[i].availableH)} disponibles (5 días) · {loads[i].extraordinaryCount} extraordinarias</p>
              </div>
              <LoadBadge level={loads[i].level} />
            </Card>
          </Link>
        ))}
      </div>

      <FilterBar>
        <input type="hidden" name="fecha" value={day} />
        <input type="hidden" name="vista" value={view} />
        <MiniSelect label="Persona" name="persona" value={sp.persona} options={members.map((m) => ({ value: m.id, label: m.fullName }))} />
        <MiniSelect label="Proyecto" name="proyecto" value={sp.proyecto} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <MiniSelect label="Prioridad" name="prioridad" value={sp.prioridad} options={opts(PRIORITY_LABEL)} />
        <MiniSelect label="Estado" name="estado" value={sp.estado} options={opts(STATUS_LABEL)} />
        <MiniSelect label="Tipo" name="tipo" value={sp.tipo} options={[{ value: "extraordinaria", label: "Extraordinarias" }, { value: "habitual", label: "Habituales" }]} />
      </FilterBar>

      <div className="my-4 flex flex-wrap items-center gap-2">
        <Link href={link({ fecha: addDays(day, -1) })} className="rounded-lg p-2 ring-1 ring-inset ring-line hover:bg-surface" aria-label="Día anterior"><ChevronLeft className="h-4 w-4" /></Link>
        <Link href={link({ fecha: addDays(day, 1) })} className="rounded-lg p-2 ring-1 ring-inset ring-line hover:bg-surface" aria-label="Día siguiente"><ChevronRight className="h-4 w-4" /></Link>
        <Link href={link({ fecha: today })} className="rounded-lg px-3 py-1.5 text-[13px] ring-1 ring-inset ring-line hover:bg-surface">Hoy</Link>
        <h2 className="ml-2 text-sm font-semibold text-navy-900">{fmtLongDate(day)}</h2>
        <div className="ml-auto inline-flex rounded-lg border border-line p-0.5 text-[13px]">
          <Link href={link({ vista: "tabla" })} className={clsx("flex items-center gap-1 rounded-md px-3 py-1", view === "tabla" ? "bg-navy-800 text-white" : "text-slate-600")}><List className="h-4 w-4" />Tabla</Link>
          <Link href={link({ vista: "kanban" })} className={clsx("flex items-center gap-1 rounded-md px-3 py-1", view === "kanban" ? "bg-navy-800 text-white" : "text-slate-600")}><Columns3 className="h-4 w-4" />Kanban</Link>
        </div>
      </div>

      {view === "kanban" ? (
        <Kanban cards={rows} />
      ) : (
        <Card>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-2xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-medium">Colaborador</th><th className="px-3 py-2 font-medium">Actividad</th><th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Prioridad</th><th className="px-3 py-2 font-medium">Estado</th><th className="px-3 py-2 font-medium">Fecha límite</th>
                    {c.scope !== "own" && <th className="px-4 py-2 font-medium">Reprogramar</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.assignmentId}>
                      <td className="px-4 py-2.5 font-medium text-navy-900">{r.memberName}</td>
                      <td className="px-3 py-2.5"><Link href={`/actividades/${r.activityId}`} className="text-navy-900 hover:underline">{r.title}</Link>{r.projectName && <p className="text-2xs text-slate-500">{r.projectName}</p>}</td>
                      <td className="px-3 py-2.5"><OriginBadge origin={r.origin} /></td>
                      <td className="px-3 py-2.5"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} overdue={r.overdue} /></td>
                      <td className={`tabular px-3 py-2.5 ${r.overdue ? "font-medium text-bad-700" : "text-slate-600"}`}>{fmtDate(r.dueDate)}</td>
                      {c.scope !== "own" && (
                        <td className="px-4 py-1.5">
                          <ActionForm action={rescheduleAction} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={r.activityId} />
                            <Input type="date" name="dueDate" defaultValue={r.dueDate ?? ""} required className="!mt-0 !w-36 !px-2 !py-1 !text-xs" />
                            <Submit variant="ghost" className="!px-2 !py-1 !text-2xs">Mover</Submit>
                          </ActionForm>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={UserPlus} title="Sin actividades del equipo para este día" text={members.length ? "Asigna una actividad o revisa otro día." : "Primero registra a tus colaboradores en Mi equipo."} />
          )}
        </Card>
      )}
    </>
  );
}
