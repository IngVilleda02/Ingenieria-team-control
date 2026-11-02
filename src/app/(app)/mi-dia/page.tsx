import Link from "next/link";
import { AlarmClock, Bell, Plus, Sparkles, Sun } from "lucide-react";
import { createActivityAction } from "@/app/(app)/actions";
import { proposeDayPlanAction } from "@/app/(app)/more-actions";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { ActionForm, Submit } from "@/components/forms";
import { Input, PageHeader, Select, Textarea } from "@/components/fields";
import { Card, CardHeader, Empty, Kpi, Progress } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtLongDate, fmtTime, hrs, opts, PRIORITY_LABEL } from "@/lib/format";
import { aiStatus } from "@/ai/provider";
import { ctx } from "@/server/context";
import { listAssignments } from "@/server/services/activities";
import { CLOSED, dateInTz, todayIn } from "@/server/services/metrics";
import { listReminders } from "@/server/services/reminders";
import { getSetting } from "@/server/services/settings";
import { getDb, schema } from "@/db/client";
import { and, eq, gte, inArray } from "drizzle-orm";

export const metadata = { title: "Mi día" };

export default async function MyDay() {
  const c = await ctx("activity.view");
  const tz = await getSetting("timezone");
  const today = todayIn(tz);
  const mine = c.session.memberId ? await listAssignments(c, { memberId: c.session.memberId }) : [];
  const open = mine.filter((a) => !CLOSED.includes(a.status));
  const isToday = (a: (typeof mine)[number]) =>
    a.dueDate === today || (a.plannedStart && dateInTz(a.plannedStart, tz) === today) || (a.startDate && a.startDate <= today && (!a.dueDate || a.dueDate >= today));
  const todayList = mine.filter((a) => isToday(a) && (a.status !== "cancelada"));
  const overdue = open.filter((a) => a.overdue);
  const priority = open.filter((a) => (a.priority === "alta" || a.priority === "critica") && !a.overdue);
  const upcoming = open.filter((a) => !isToday(a) && !a.overdue && a.dueDate && a.dueDate > today).slice(0, 8);
  const scheduled = todayList.filter((a) => a.plannedStart).sort((a, b) => +a.plannedStart! - +b.plannedStart!);

  const db = await getDb();
  const ids = mine.map((m) => m.assignmentId);
  const startOfDay = new Date(`${today}T00:00:00-06:00`);
  const entries = ids.length ? await db.select().from(schema.timeEntry).where(and(inArray(schema.timeEntry.assignmentId, ids), gte(schema.timeEntry.startedAt, startOfDay))) : [];
  const realToday = Math.round((entries.reduce((t, e) => t + e.minutes, 0) / 60) * 10) / 10;
  const estToday = Math.round(todayList.filter((a) => a.status !== "completada").reduce((t, a) => t + (a.estimatedH ?? 0) * (1 - a.progressPct / 100), 0) * 10) / 10;
  const doneToday = todayList.filter((a) => a.status === "completada").length;
  const reminders = (await listReminders(c)).filter((r) => dateInTz(r.r.fireAt, tz) === today && (r.r.scope === "personal" || true)).slice(0, 8);
  const ai = aiStatus();

  return (
    <>
      <PageHeader icon={Sun} title="Mi día" subtitle={fmtLongDate(today)} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Actividades de hoy" value={todayList.length} hint={`${doneToday} completadas`} tone="sky" />
        <Kpi label="Atrasadas" value={overdue.length} tone={overdue.length ? "bad" : "navy"} />
        <Kpi label="Tiempo estimado restante" value={hrs(estToday)} />
        <Kpi label="Tiempo real invertido hoy" value={hrs(realToday)} tone="ok" />
      </div>
      <div className="mt-3">
        <Card className="px-4 py-3">
          <div className="flex items-center justify-between text-xs text-slate-500"><span>Avance diario</span><span className="tabular">{todayList.length ? Math.round((doneToday / todayList.length) * 100) : 0}%</span></div>
          <div className="mt-2"><Progress value={todayList.length ? (doneToday / todayList.length) * 100 : 0} tone="ok" /></div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Actividades de hoy" subtitle="Personales y las que te asignaste" />
            {todayList.length ? (
              <ul className="divide-y divide-line">
                {todayList.map((a) => (
                  <li key={a.assignmentId} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    <span className="tabular w-24 shrink-0 text-2xs text-slate-500">{a.plannedStart ? `${fmtTime(a.plannedStart, tz)}–${fmtTime(a.plannedEnd, tz)}` : "Sin horario"}</span>
                    <Link href={`/actividades/${a.activityId}`} className={`min-w-0 flex-1 truncate text-[13px] font-medium hover:underline ${a.status === "completada" ? "text-slate-400 line-through" : "text-navy-900"}`}>{a.title}</Link>
                    <PriorityBadge priority={a.priority} />
                    <StatusBadge status={a.status} overdue={a.overdue} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={Sun} title="Nada programado para hoy" text="Agrega una actividad o pide a la IA que organice tu día." />
            )}
          </Card>

          <Card>
            <CardHeader title="Organizar mi día" subtitle={ai.configured ? `Con IA (${ai.provider}) · tú apruebas el horario` : "Desglose básico sin IA · tú apruebas el horario"} action={<Sparkles className="h-4 w-4 text-sky-500" />} />
            <ActionForm action={proposeDayPlanAction} className="space-y-2 px-4 py-3">
              <Textarea name="text" rows={3} className="!mt-0" placeholder="Hoy necesito revisar la programación del robot, terminar el dashboard de producción, revisar las actividades de mi equipo y documentar los avances." />
              <Submit><Sparkles className="h-3.5 w-3.5" />Proponer horario</Submit>
            </ActionForm>
            {scheduled.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-slate-500">Horario aprobado</p>
                <ol className="space-y-1">
                  {scheduled.map((a) => (
                    <li key={a.assignmentId} className="flex gap-3 text-[13px]"><span className="tabular w-24 text-slate-500">{fmtTime(a.plannedStart, tz)}–{fmtTime(a.plannedEnd, tz)}</span><span className="text-navy-900">{a.title}</span></li>
                  ))}
                </ol>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Agregar actividad personal rápida" />
            <ActionForm action={createActivityAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_120px_110px_auto]">
              <input type="hidden" name="origin" value="personal" />
              <input type="hidden" name="startDate" value={today} />
              <input type="hidden" name="returnTo" value="/mi-dia" />
              <Input name="title" placeholder="¿Qué vas a hacer?" required minLength={3} className="!mt-0" />
              <Select name="priority" defaultValue="media" options={opts(PRIORITY_LABEL)} className="!mt-0" />
              <Input name="estimatedH" type="number" step="0.25" min="0" placeholder="Horas" className="!mt-0" />
              <input type="hidden" name="dueDate" value={today} />
              <Submit><Plus className="h-4 w-4" />Agregar</Submit>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Atrasadas" />
            {overdue.length ? (
              <ul className="divide-y divide-line">{overdue.map((a) => <li key={a.assignmentId} className="px-4 py-2"><Link href={`/actividades/${a.activityId}`} className="text-[13px] text-navy-900 hover:underline">{a.title}</Link><p className="text-2xs text-bad-700">Venció {fmtDate(a.dueDate)}</p></li>)}</ul>
            ) : <p className="px-4 py-3 text-xs text-slate-500">Sin atrasos.</p>}
          </Card>
          <Card>
            <CardHeader title="Prioritarias" />
            {priority.length ? (
              <ul className="divide-y divide-line">{priority.map((a) => <li key={a.assignmentId} className="flex items-center justify-between gap-2 px-4 py-2"><Link href={`/actividades/${a.activityId}`} className="truncate text-[13px] text-navy-900 hover:underline">{a.title}</Link><PriorityBadge priority={a.priority} /></li>)}</ul>
            ) : <p className="px-4 py-3 text-xs text-slate-500">Sin actividades de prioridad alta.</p>}
          </Card>
          <Card>
            <CardHeader title="Pendientes próximas" />
            {upcoming.length ? (
              <ul className="divide-y divide-line">{upcoming.map((a) => <li key={a.assignmentId} className="flex justify-between gap-2 px-4 py-2"><Link href={`/actividades/${a.activityId}`} className="truncate text-[13px] text-navy-900 hover:underline">{a.title}</Link><span className="tabular shrink-0 text-2xs text-slate-500">{fmtDate(a.dueDate)}</span></li>)}</ul>
            ) : <p className="px-4 py-3 text-xs text-slate-500">—</p>}
          </Card>
          <Card>
            <CardHeader title="Recordatorios de hoy" action={<Bell className="h-4 w-4 text-slate-400" />} />
            {reminders.length ? (
              <ul className="divide-y divide-line">{reminders.map((r) => <li key={r.r.id} className="flex gap-2 px-4 py-2 text-[13px]"><AlarmClock className="mt-0.5 h-3.5 w-3.5 text-slate-400" /><span className="text-navy-900">{r.r.title}</span><span className="ml-auto text-2xs text-slate-500">{fmtDateTime(r.r.fireAt, tz)}</span></li>)}</ul>
            ) : <p className="px-4 py-3 text-xs text-slate-500">Sin recordatorios hoy. <Link href="/recordatorios" className="text-sky-600 hover:underline">Crear</Link></p>}
          </Card>
        </div>
      </div>
    </>
  );
}
