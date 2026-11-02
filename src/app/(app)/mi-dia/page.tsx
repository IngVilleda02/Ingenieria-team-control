import Link from "next/link";
import { Plus, Sun } from "lucide-react";
import { createActivityAction } from "@/app/(app)/actions";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { ActionForm, Submit } from "@/components/forms";
import { Input, PageHeader } from "@/components/fields";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui";
import { fmtDate, fmtLongDate, fmtTime } from "@/lib/format";
import { ctx } from "@/server/context";
import { listAssignments } from "@/server/services/activities";
import { CLOSED, dateInTz, todayIn } from "@/server/services/metrics";
import { getSetting } from "@/server/services/settings";

export const metadata = { title: "Mi día" };

export default async function MyDay() {
  const c = await ctx("activity.view");
  const tz = await getSetting("timezone");
  const today = todayIn(tz);
  const mine = c.session.memberId ? await listAssignments(c, { memberId: c.session.memberId }) : [];
  const open = mine.filter((a) => !CLOSED.includes(a.status));
  const isToday = (a: (typeof mine)[number]) =>
    a.dueDate === today || (a.plannedStart && dateInTz(a.plannedStart, tz) === today) || (a.startDate && a.startDate <= today && (!a.dueDate || a.dueDate >= today));
  const todayList = mine.filter((a) => isToday(a) && a.status !== "cancelada");
  const overdue = open.filter((a) => a.overdue);
  const priority = open.filter((a) => (a.priority === "alta" || a.priority === "critica") && !a.overdue);
  const doneToday = todayList.filter((a) => a.status === "completada").length;

  return (
    <>
      <PageHeader icon={Sun} title="Mi día" subtitle={fmtLongDate(today)} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Actividades de hoy" value={todayList.length} tone="sky" />
        <Kpi label="Completadas hoy" value={doneToday} tone="ok" />
        <Kpi label="Atrasadas" value={overdue.length} tone={overdue.length ? "bad" : "navy"} />
        <Kpi label="Prioritarias" value={priority.length} tone={priority.length ? "warn" : "navy"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Agregar actividad personal rápida" subtitle="Queda a tu nombre, programada para hoy" />
            <ActionForm action={createActivityAction} className="flex flex-col gap-2 px-4 py-3 sm:flex-row">
              <input type="hidden" name="origin" value="personal" />
              <input type="hidden" name="startDate" value={today} />
              <input type="hidden" name="dueDate" value={today} />
              <input type="hidden" name="returnTo" value="/mi-dia" />
              <Input name="title" placeholder="¿Qué vas a hacer?" required minLength={3} className="!mt-0 min-w-0 flex-1" />
              <Submit><Plus className="h-4 w-4" />Agregar</Submit>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Actividades de hoy" subtitle="Personales y las que te asignaste" />
            {todayList.length ? (
              <ul className="divide-y divide-line">
                {todayList.map((a) => (
                  <li key={a.assignmentId} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    {a.plannedStart && <span className="tabular w-24 shrink-0 text-2xs text-slate-500">{fmtTime(a.plannedStart, tz)}–{fmtTime(a.plannedEnd, tz)}</span>}
                    <Link href={`/actividades/${a.activityId}`} className={`min-w-0 flex-1 truncate text-[13px] font-medium hover:underline ${a.status === "completada" ? "text-slate-400 line-through" : "text-navy-900"}`}>{a.title}</Link>
                    <PriorityBadge priority={a.priority} />
                    <StatusBadge status={a.status} overdue={a.overdue} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={Sun} title="Nada programado para hoy" text="Escribe arriba lo que vas a hacer y pulsa Agregar." />
            )}
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
        </div>
      </div>
    </>
  );
}
