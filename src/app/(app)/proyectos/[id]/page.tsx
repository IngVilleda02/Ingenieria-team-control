import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Sparkles } from "lucide-react";
import { archiveProjectAction, commentAction, deleteProjectAction } from "@/app/(app)/actions";
import { OriginBadge, PriorityBadge, ProjectStatusBadge, StatusBadge } from "@/components/badges";
import { ActionForm, Submit } from "@/components/forms";
import { Input, LinkButton } from "@/components/fields";
import { Gantt } from "@/components/Gantt";
import { Badge, Card, CardHeader, Empty, Insufficient, Kpi } from "@/components/ui";
import { fmtDate, pct } from "@/lib/format";
import { ctx } from "@/server/context";
import { timeline } from "@/server/services/logbook";
import { todayIn } from "@/server/services/metrics";
import { getProject } from "@/server/services/projects";
import { getSetting } from "@/server/services/settings";
import { Timeline } from "@/components/Timeline";

export const metadata = { title: "Proyecto" };

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx("project.view");
  const d = await getProject(c, id);
  const tz = await getSetting("timezone");
  const today = todayIn(tz);
  const p = d.project;
  const m = d.metrics;
  const canManage = c.scope !== "own";
  const byActivity = new Map<string, (typeof d.items)[number] & { who: string[] }>();
  for (const i of d.items) {
    const cur = byActivity.get(i.activityId);
    if (cur) cur.who.push(i.memberName);
    else byActivity.set(i.activityId, { ...i, who: [i.memberName] });
  }
  const acts = [...byActivity.values()].sort((a, b) => String(a.startDate ?? a.dueDate ?? "").localeCompare(String(b.startDate ?? b.dueDate ?? "")));
  const log = await timeline(c, { projectId: id, limit: 40 });

  return (
    <>
      <Link href="/proyectos" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-navy-900"><ArrowLeft className="h-3.5 w-3.5" />Proyectos</Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <ProjectStatusBadge status={p.status} />
            <PriorityBadge priority={p.priority} />
            {p.category && <Badge>{p.category}</Badge>}
            {m.atRisk && <Badge tone="bad">Requiere atención</Badge>}
            {p.archivedAt && <Badge>Archivado</Badge>}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">{p.name}</h1>
          <p className="mt-1 text-xs text-slate-500">
            Responsable: {d.owner?.fullName ?? "—"} · {fmtDate(p.startDate)} → {fmtDate(p.dueDate)}
            {p.finishedAt ? ` · terminado ${fmtDate(p.finishedAt)}` : ""}
            {p.budget ? ` · presupuesto $${Number(p.budget).toLocaleString("es-MX")}` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/asignaciones/nueva?proyecto=${id}`}><Plus className="h-4 w-4" />Asignar actividad</LinkButton>
            <LinkButton href={`/actividades/nueva?proyecto=${id}`} variant="soft"><Plus className="h-4 w-4" />Actividad personal</LinkButton>
            <LinkButton href={`/asistente?modo=checklist&proyecto=${id}`} variant="soft"><Sparkles className="h-4 w-4" />Desglosar con IA</LinkButton>
            <LinkButton href={`/proyectos/${id}/editar`} variant="soft"><Pencil className="h-4 w-4" />Editar</LinkButton>
          </div>
        )}
      </header>

      {/* Dashboard del proyecto */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Avance real (ponderado)" value={pct(m.progress) ?? <Insufficient />} tone="sky" />
        <Kpi label="Tiempo transcurrido" value={pct(m.elapsedPct) ?? "—"} hint={m.daysLeft == null ? "Sin fechas" : m.daysLeft >= 0 ? `${m.daysLeft} días restantes` : `${-m.daysLeft} días de retraso`} tone={m.daysLeft != null && m.daysLeft < 0 ? "bad" : "navy"} />
        <Kpi label="Avance vs. plan" value={m.variance == null ? "—" : `${m.variance > 0 ? "+" : ""}${m.variance} pts`} tone={m.variance != null && m.variance < -10 ? "bad" : m.variance != null && m.variance < 0 ? "warn" : "ok"} />
        <Kpi label="Fecha proyectada de cierre" value={m.projectedEnd ? fmtDate(m.projectedEnd, { day: "numeric", month: "short", year: "2-digit" }) : <Insufficient />} hint={m.projectedEnd ? `Ritmo ${m.ratePerDay} pts/día (últimos 28 días)` : "Se calcula al cerrar actividades"} tone={m.projectedEnd && p.dueDate && m.projectedEnd > p.dueDate ? "bad" : "navy"} />
        <Kpi label="Pendientes" value={m.pendingCount} hint={`${m.overdueCount} vencidas`} tone={m.overdueCount ? "bad" : "navy"} />
        <Kpi label="Entregas a tiempo" value={pct(m.onTime) ?? <Insufficient />} tone="ok" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-3">
          <CardHeader title="Cronograma" subtitle="Barras de inicio a fecha límite · la línea punteada es el cierre estimado del proyecto" />
          <div className="p-3">
            <Gantt
              today={today}
              projectStart={p.startDate}
              projectEnd={p.dueDate}
              rows={acts.map((a) => ({ id: a.activityId, title: a.title, start: a.startDate, end: a.dueDate, status: a.status, overdue: a.overdue, who: a.who.join(", ") }))}
            />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Actividades del proyecto" subtitle="De todos los colaboradores, por fecha" />
          {acts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-2xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-medium">Actividad</th><th className="px-3 py-2 font-medium">Responsable</th>
                    <th className="px-3 py-2 font-medium">Tipo</th><th className="px-3 py-2 font-medium">Estado</th><th className="px-4 py-2 text-right font-medium">Límite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {acts.map((a) => (
                    <tr key={a.activityId}>
                      <td className="px-4 py-2.5"><Link href={`/actividades/${a.activityId}`} className="font-medium text-navy-900 hover:underline">{a.title}</Link></td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{a.who.join(", ")}</td>
                      <td className="px-3 py-2.5"><OriginBadge origin={a.origin} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={a.status} overdue={a.overdue} /></td>
                      <td className={`tabular px-4 py-2.5 text-right text-xs ${a.overdue ? "font-medium text-bad-700" : "text-slate-600"}`}>{fmtDate(a.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Sin actividades" text="Asígnalas a tu equipo o desglósalas con IA." />
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Participantes" />
            <ul className="space-y-1 px-4 py-3 text-[13px]">
              {d.members.map((mm) => <li key={mm.id}><Link href={`/equipo/${mm.id}`} className="text-navy-900 hover:underline">{mm.name}</Link></li>)}
            </ul>
          </Card>
          {(p.objective || p.description || p.notes) && (
            <Card>
              <CardHeader title="Descripción y objetivo" />
              <div className="space-y-2 px-4 py-3 text-[13px] text-slate-700">
                {p.objective && <p><span className="font-medium text-navy-900">Objetivo:</span> {p.objective}</p>}
                {p.description && <p className="whitespace-pre-wrap">{p.description}</p>}
                {p.notes && <p className="whitespace-pre-wrap text-xs text-slate-500">{p.notes}</p>}
              </div>
            </Card>
          )}
        </div>

        <Card className="xl:col-span-3">
          <CardHeader title="Línea de tiempo" subtitle="Bitácora automática del proyecto" />
          <Timeline items={log} tz={tz} />
          <ActionForm action={commentAction} resetOnOk className="flex gap-2 border-t border-line px-4 py-3">
            <input type="hidden" name="entityType" value="project" />
            <input type="hidden" name="entityId" value={id} />
            <Input name="body" placeholder="Nota o acuerdo" required className="!mt-0 !py-1.5" />
            <Submit variant="soft">Anotar</Submit>
          </ActionForm>
        </Card>
      </div>

      {c.scope === "all" && (
        <Card className="mt-6 border-red-100">
          <CardHeader title="Zona de administración" />
          <div className="flex flex-wrap items-end gap-4 px-4 py-4">
            <ActionForm action={archiveProjectAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="archive" value={p.archivedAt ? "0" : "1"} />
              <Submit variant="soft">{p.archivedAt ? "Restaurar proyecto" : "Archivar proyecto"}</Submit>
            </ActionForm>
            <ActionForm action={deleteProjectAction} className="flex flex-wrap items-end gap-2" confirm="Esta acción quita el proyecto y sus actividades de todas las vistas. ¿Continuar?">
              <input type="hidden" name="id" value={id} />
              <label className="text-2xs text-slate-500">Escribe el nombre exacto para eliminar<Input name="confirm" placeholder={p.name} className="!py-1.5" /></label>
              <Submit variant="danger">Eliminar proyecto</Submit>
            </ActionForm>
          </div>
        </Card>
      )}
    </>
  );
}
