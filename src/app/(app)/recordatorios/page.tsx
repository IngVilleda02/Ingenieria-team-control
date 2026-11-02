import Link from "next/link";
import { Bell, BellRing, Trash2 } from "lucide-react";
import { createReminderAction, deleteReminderAction, markReadAction } from "@/app/(app)/more-actions";
import { ActionForm, Submit } from "@/components/forms";
import { Checkbox, Field, Input, PageHeader, Select } from "@/components/fields";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import { fmtDateTime, opts } from "@/lib/format";
import { ctx } from "@/server/context";
import { activityOptions } from "@/server/services/activities";
import { memberOptions } from "@/server/services/members";
import { projectOptions } from "@/server/services/projects";
import { listNotifications, listReminders, OFFSETS, REMINDER_KINDS, syncNotifications } from "@/server/services/reminders";
import { getSetting } from "@/server/services/settings";
import { todayIn } from "@/server/services/metrics";

export const metadata = { title: "Recordatorios" };
const SCOPE_TONE = { personal: "navy", proyecto: "sky", equipo: "warn" } as const;
const SCOPE_LABEL = { personal: "Personal", proyecto: "Proyecto", equipo: "Equipo" } as const;

export default async function RemindersPage() {
  const c = await ctx("activity.view");
  await syncNotifications(c.db);
  const tz = await getSetting("timezone");
  const [reminders, notes, members, projects, activities] = await Promise.all([listReminders(c), listNotifications(c, 60), memberOptions(c), projectOptions(c), activityOptions(c)]);
  const pending = reminders.filter((r) => !r.r.firedAt);
  return (
    <>
      <PageHeader icon={Bell} title="Recordatorios y notificaciones" />
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader title="Nuevo recordatorio" />
          <ActionForm action={createReminderAction} resetOnOk className="space-y-3 p-4">
            <Field label="Recordatorio"><Input name="title" required minLength={3} placeholder="Revisar avance del proyecto de soldadura" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo"><Select name="kind" options={opts(REMINDER_KINDS)} /></Field>
              <Field label="Ámbito"><Select name="scope" options={opts(SCOPE_LABEL)} /></Field>
            </div>
            <Field label="Colaborador (ámbito equipo)"><Select name="memberId" placeholder="—" options={members.filter((m) => !m.isAdmin).map((m) => ({ value: m.id, label: m.name }))} /></Field>
            <Field label="Proyecto (ámbito proyecto)"><Select name="projectId" placeholder="—" options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
            <Field label="Actividad relacionada (opcional)"><Select name="activityId" placeholder="—" options={activities.map((a) => ({ value: a.id, label: a.title }))} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Fecha del evento"><Input type="date" name="eventDate" required defaultValue={todayIn(tz)} /></Field>
              <Field label="Hora"><Input type="time" name="eventTime" defaultValue="08:00" /></Field>
            </div>
            <Field label="Avisar">
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {Object.entries(OFFSETS).map(([k, l]) => <Checkbox key={k} name="offsets" value={k} label={l} defaultChecked={k === "24h"} />)}
              </div>
            </Field>
            <Field label="Fecha y hora personalizada"><Input type="datetime-local" name="customAt" /></Field>
            <Submit>Crear recordatorio</Submit>
          </ActionForm>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Notificaciones" subtitle="Generadas automáticamente: recordatorios, próximas a vencer y vencidas" action={notes.some((n) => !n.readAt) ? <ActionForm action={markReadAction}><Submit variant="ghost" className="!py-1 !text-xs">Marcar todo como leído</Submit></ActionForm> : null} />
            {notes.length ? (
              <ul className="divide-y divide-line">
                {notes.map((n) => (
                  <li key={n.id} className={`flex items-start gap-3 px-4 py-2.5 ${n.readAt ? "" : "bg-sky-50/50"}`}>
                    <BellRing className={`mt-0.5 h-4 w-4 shrink-0 ${n.readAt ? "text-slate-300" : "text-sky-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={SCOPE_TONE[n.scope]}>{SCOPE_LABEL[n.scope]}</Badge>
                        {n.link ? <Link href={n.link} className="truncate text-[13px] font-medium text-navy-900 hover:underline">{n.title}</Link> : <span className="text-[13px] font-medium text-navy-900">{n.title}</span>}
                      </div>
                      <p className="text-2xs text-slate-500">{n.body} · {fmtDateTime(n.createdAt, tz)}</p>
                    </div>
                    {!n.readAt && <ActionForm action={markReadAction}><input type="hidden" name="id" value={n.id} /><Submit variant="ghost" className="!px-1.5 !py-0.5 !text-2xs">Leída</Submit></ActionForm>}
                  </li>
                ))}
              </ul>
            ) : <Empty icon={Bell} title="Sin notificaciones" />}
          </Card>
          <Card>
            <CardHeader title="Recordatorios programados" subtitle={`${pending.length} pendientes`} />
            {reminders.length ? (
              <ul className="divide-y divide-line">
                {reminders.map(({ r, projectName, memberName, activityTitle }) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <Badge tone={SCOPE_TONE[r.scope]}>{SCOPE_LABEL[r.scope]}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className={r.firedAt ? "text-slate-400" : "text-navy-900"}>{r.title}</p>
                      <p className="text-2xs text-slate-500">{REMINDER_KINDS[r.kind]} · {OFFSETS[r.offsetLabel ?? "0"]} · {[projectName, memberName, activityTitle].filter(Boolean).join(" · ")}</p>
                    </div>
                    <span className="tabular text-2xs text-slate-500">{r.firedAt ? "Enviado" : fmtDateTime(r.fireAt, tz)}</span>
                    <ActionForm action={deleteReminderAction}><input type="hidden" name="id" value={r.id} /><Submit variant="ghost" className="!p-1" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Submit></ActionForm>
                  </li>
                ))}
              </ul>
            ) : <Empty title="Sin recordatorios" />}
          </Card>
        </div>
      </div>
    </>
  );
}
