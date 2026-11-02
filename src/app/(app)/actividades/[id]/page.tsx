import Link from "next/link";
import { ArrowLeft, Clock, FileText, History, ListChecks, MessageSquare, Pencil, Plus } from "lucide-react";
import {
  cancelActivityAction, checklistAddAction, commentAction, deleteActivityAction, rescheduleAction, statusAction, timeAction,
} from "@/app/(app)/actions";
import { OriginBadge, PriorityBadge, StatusBadge } from "@/components/badges";
import { ChecklistItem } from "@/components/ChecklistItem";
import { ActionForm, Submit } from "@/components/forms";
import { Input, LinkButton, Select, Textarea } from "@/components/fields";
import { Badge, Card, CardHeader, Empty, Progress } from "@/components/ui";
import { ACTION_LABEL, fmtDate, fmtDateTime, hrs, opts, STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/context";
import { getActivity } from "@/server/services/activities";
import { isOverdue, todayIn } from "@/server/services/metrics";
import { getSetting } from "@/server/services/settings";

export const metadata = { title: "Actividad" };

export default async function ActivityDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx("activity.view");
  const d = await getActivity(c, id);
  const a = d.activity;
  const tz = await getSetting("timezone");
  const today = todayIn(tz);
  const canManage = c.scope !== "own";
  const done = d.checklist.filter((i) => i.done).length;

  return (
    <>
      <Link href="/actividades" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-navy-900"><ArrowLeft className="h-3.5 w-3.5" />Actividades</Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <OriginBadge origin={a.origin} />
            <PriorityBadge priority={a.priority} />
            <Badge>Complejidad {a.complexity}/5</Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">{a.title}</h1>
          {d.project && <Link href={`/proyectos/${d.project.id}`} className="mt-1 inline-block text-xs text-sky-600 hover:underline">{d.project.name}</Link>}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/actividades/${id}/editar`} variant="soft"><Pencil className="h-4 w-4" />Editar</LinkButton>
            <ActionForm action={cancelActivityAction} confirm="¿Cancelar esta actividad para todos los responsables?">
              <input type="hidden" name="id" value={id} />
              <Submit variant="soft">Cancelar</Submit>
            </ActionForm>
            {c.scope === "all" && (
              <ActionForm action={deleteActivityAction} confirm="¿Eliminar la actividad? Saldrá de listas e indicadores; el historial se conserva.">
                <input type="hidden" name="id" value={id} />
                <Submit variant="danger">Eliminar</Submit>
              </ActionForm>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Detalle" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 text-[13px] sm:grid-cols-3">
              {[
                ["Asignada", fmtDateTime(a.assignedAt, tz)],
                ["Inicio", fmtDate(a.startDate)],
                ["Fecha límite", fmtDate(a.dueDate)],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-2xs uppercase tracking-wide text-slate-500">{k}</dt><dd className="mt-0.5 text-navy-900">{v}</dd></div>
              ))}
            </dl>
            {(a.description || a.instructions) && (
              <div className="space-y-3 border-t border-line px-4 py-4 text-[13px] text-slate-700">
                {a.description && <p className="whitespace-pre-wrap">{a.description}</p>}
                {a.instructions && (
                  <div><p className="text-2xs font-medium uppercase tracking-wide text-slate-500">Instrucciones</p><p className="mt-1 whitespace-pre-wrap">{a.instructions}</p></div>
                )}
              </div>
            )}
            {canManage && (
              <ActionForm action={rescheduleAction} className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
                <input type="hidden" name="id" value={id} />
                <label className="text-2xs text-slate-500">Nuevo inicio<Input type="date" name="startDate" defaultValue={a.startDate ?? ""} className="!py-1.5" /></label>
                <label className="text-2xs text-slate-500">Nueva fecha límite<Input type="date" name="dueDate" defaultValue={a.dueDate ?? ""} required className="!py-1.5" /></label>
                <Submit variant="soft">Reprogramar</Submit>
              </ActionForm>
            )}
          </Card>

          {/* Responsables: cada uno con su estado, avance y horas */}
          <Card>
            <CardHeader title="Responsables y avance" subtitle="Cada persona tiene su propio estado, avance y tiempo real" />
            <ul className="divide-y divide-line">
              {d.assignments.map(({ a: as, memberName, memberIsAdmin }) => {
                const overdue = isOverdue({ dueDate: a.dueDate, status: as.status }, today);
                return (
                  <li key={as.id} className="space-y-3 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-navy-900">{memberIsAdmin ? `${memberName} (yo)` : memberName}</p>
                      <StatusBadge status={as.status} overdue={overdue} />
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={as.progressPct} tone={as.status === "completada" ? "ok" : overdue ? "bad" : "sky"} />
                      <span className="tabular w-10 text-right text-xs text-slate-600">{as.progressPct}%</span>
                    </div>
                    <p className="text-2xs text-slate-500">
                      Inicio real {fmtDateTime(as.startedAt, tz)} · Fin real {fmtDateTime(as.finishedAt, tz)} · Tiempo real {hrs(as.actualH == null ? null : Number(as.actualH))}
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <ActionForm action={statusAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="assignmentId" value={as.id} />
                        <label className="flex-1 text-2xs text-slate-500">Estado
                          <Select name="status" defaultValue={as.status} options={opts(STATUS_LABEL)} className="!py-1.5" />
                        </label>
                        <label className="w-20 text-2xs text-slate-500">Avance %
                          <Input name="progressPct" type="number" min="0" max="100" defaultValue={as.progressPct} className="!py-1.5" />
                        </label>
                        <Submit variant="soft">Actualizar</Submit>
                      </ActionForm>
                      <ActionForm action={timeAction} resetOnOk className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="assignmentId" value={as.id} />
                        <label className="w-16 text-2xs text-slate-500">Horas<Input name="hours" type="number" min="0" step="0.25" className="!py-1.5" /></label>
                        <label className="w-16 text-2xs text-slate-500">Min<Input name="minutes" type="number" min="0" max="59" className="!py-1.5" /></label>
                        <label className="flex-1 text-2xs text-slate-500">Nota<Input name="note" className="!py-1.5" /></label>
                        <Submit variant="soft"><Clock className="h-3.5 w-3.5" />Registrar</Submit>
                      </ActionForm>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Checklist" subtitle={d.checklist.length ? `${done} de ${d.checklist.length} pasos` : undefined} />
            <div className="px-3 py-2">
              {d.checklist.length ? d.checklist.map((i) => <ChecklistItem key={i.id} id={i.id} text={i.text} done={i.done} />) : <p className="px-1 py-2 text-xs text-slate-500">Sin pasos todavía.</p>}
            </div>
            <ActionForm action={checklistAddAction} resetOnOk className="flex gap-2 border-t border-line px-4 py-3">
              <input type="hidden" name="activityId" value={id} />
              <Input name="text" placeholder="Agregar paso" className="!mt-0 !py-1.5" required />
              <Submit variant="soft"><ListChecks className="h-3.5 w-3.5" />Agregar</Submit>
            </ActionForm>
          </Card>

        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Dependencias y subtareas" />
            <div className="space-y-3 px-4 py-3 text-[13px]">
              <div>
                <p className="text-2xs uppercase tracking-wide text-slate-500">Depende de</p>
                {d.deps.length ? d.deps.map((x) => <Link key={x.id} href={`/actividades/${x.id}`} className="block text-sky-600 hover:underline">{x.title}</Link>) : <p className="text-slate-500">—</p>}
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wide text-slate-500">Bloquea a</p>
                {d.blocks.length ? d.blocks.map((x) => <Link key={x.id} href={`/actividades/${x.id}`} className="block text-sky-600 hover:underline">{x.title}</Link>) : <p className="text-slate-500">—</p>}
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wide text-slate-500">Subtareas</p>
                {d.subtasks.map((x) => <Link key={x.id} href={`/actividades/${x.id}`} className="block text-sky-600 hover:underline">{x.title}</Link>)}
                {canManage && (
                  <Link href={a.origin === "personal" ? `/actividades/nueva?padre=${id}${a.projectId ? `&proyecto=${a.projectId}` : ""}` : `/asignaciones/nueva?padre=${id}${a.projectId ? `&proyecto=${a.projectId}` : ""}`} className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-navy-900">
                    <Plus className="h-3.5 w-3.5" />Agregar subtarea
                  </Link>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Registro de horas" action={<Clock className="h-4 w-4 text-slate-400" />} />
            {d.time.length ? (
              <ul className="max-h-60 divide-y divide-line overflow-y-auto">
                {d.time.map(({ t, memberName }) => (
                  <li key={t.id} className="flex justify-between gap-2 px-4 py-2 text-xs">
                    <span className="text-slate-600">{memberName}{t.note ? ` · ${t.note}` : ""}</span>
                    <span className="tabular shrink-0 text-navy-900">{Math.floor(t.minutes / 60)} h {t.minutes % 60} min</span>
                  </li>
                ))}
              </ul>
            ) : <Empty icon={Clock} title="Sin horas registradas" />}
          </Card>

          <Card>
            <CardHeader title="Comentarios" action={<MessageSquare className="h-4 w-4 text-slate-400" />} />
            <ul className="max-h-72 space-y-3 overflow-y-auto px-4 py-3">
              {d.comments.map(({ c: cm, author }) => (
                <li key={cm.id} className="text-[13px]">
                  <p className="text-2xs text-slate-500">{author ?? "—"} · {fmtDateTime(cm.createdAt, tz)}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-navy-900">{cm.body}</p>
                </li>
              ))}
              {!d.comments.length && <li className="text-xs text-slate-500">Sin comentarios.</li>}
            </ul>
            <ActionForm action={commentAction} resetOnOk className="space-y-2 border-t border-line px-4 py-3">
              <input type="hidden" name="entityType" value="activity" />
              <input type="hidden" name="entityId" value={id} />
              <Textarea name="body" rows={2} placeholder="Escribe un comentario" required className="!mt-0" />
              <Submit variant="soft">Comentar</Submit>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Historial de modificaciones" action={<History className="h-4 w-4 text-slate-400" />} />
            <ol className="max-h-96 space-y-2.5 overflow-y-auto px-4 py-3">
              {d.history.map((h) => (
                <li key={h.id} className="flex gap-2 text-xs">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-navy-900">{ACTION_LABEL[h.action] ?? h.action}{describe(h.before, h.after)}</p>
                    <p className="text-2xs text-slate-500">{fmtDateTime(h.at, tz)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

function describe(before: unknown, after: unknown) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  if (a.status) return `: ${STATUS_LABEL[String(b.status)] ?? "—"} → ${STATUS_LABEL[String(a.status)]}${a.progressPct != null ? ` (${a.progressPct}%)` : ""}`;
  if ("dueDate" in a) return `: límite ${b.dueDate ?? "—"} → ${a.dueDate ?? "—"}`;
  if (a.minutes) return `: ${a.minutes} min`;
  if (a.text) return `: ${a.text}`;
  if (b.text) return `: ${b.text}`;
  if ("priority" in a) return `: ${b.priority} → ${a.priority}`;
  return "";
}
