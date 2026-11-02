import Link from "next/link";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { addRoutineAction, timeOffAction, toggleRoutineAction } from "@/app/(app)/actions";
import { LoadBadge, OriginBadge, StatusBadge } from "@/components/badges";
import { OriginSeriesChart } from "@/components/charts/OriginSeriesChart";
import { EvidenceList } from "@/components/EvidenceList";
import { ActionForm, Submit } from "@/components/forms";
import { Input, LinkButton, Select } from "@/components/fields";
import { IndicatorBlock } from "@/components/IndicatorBlock";
import { Timeline } from "@/components/Timeline";
import { Badge, Card, CardHeader, Empty, Kpi } from "@/components/ui";
import { fmtDate, hrs, opts, PRIORITY_LABEL, PROJECT_STATUS_LABEL, SHIFT_LABEL, WEEKDAYS } from "@/lib/format";
import { ctx } from "@/server/context";
import { memberIndicators } from "@/server/services/indicators";
import { timeline } from "@/server/services/logbook";
import { getMember } from "@/server/services/members";
import { getSetting } from "@/server/services/settings";
import { LEVEL_LABEL, memberWorkload } from "@/server/services/workload";

export const metadata = { title: "Perfil del colaborador" };

export default async function MemberProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const c = await ctx("activity.view");
  const tz = await getSetting("timezone");
  const [d, ind, wl, log] = await Promise.all([getMember(c, id), memberIndicators(c, id), memberWorkload(c, id), timeline(c, { memberId: id, limit: 40 })]);
  const m = d.member;
  const tab = sp.tipo ?? "abiertas";
  const list = ind.items
    .filter((i) => (tab === "abiertas" ? !["completada", "cancelada"].includes(i.status) : tab === "completadas" ? i.status === "completada" : tab === "vencidas" ? i.overdue : i.origin === tab))
    .slice(0, 100);
  const isAdmin = c.scope === "all";

  return (
    <>
      <Link href="/equipo" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-navy-900"><ArrowLeft className="h-3.5 w-3.5" />Mi equipo</Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {!m.isActive && <Badge>Inactivo</Badge>}
            {m.isAdmin && <Badge tone="navy">Administrador</Badge>}
            <LoadBadge level={wl.level} />
            <Badge>Turno: {SHIFT_LABEL[wl.shiftThisWeek]}{wl.shiftAssumed ? " (supuesto)" : ""}</Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">{m.fullName}</h1>
          <p className="mt-1 text-xs text-slate-500">{[m.position, m.area, m.specialty].filter(Boolean).join(" · ")}{m.internalCode ? ` · ${m.internalCode}` : ""} · en el sistema desde {fmtDate(m.joinedAt, { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {!m.isAdmin && <LinkButton href={`/asignaciones/nueva?persona=${id}`}><Plus className="h-4 w-4" />Asignar actividad</LinkButton>}
            <LinkButton href={`/equipo/${id}/editar`} variant="soft"><Pencil className="h-4 w-4" />Editar ficha</LinkButton>
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Asignadas" value={ind.all.total} />
        <Kpi label="Completadas" value={ind.all.completed} tone="ok" />
        <Kpi label="Pendientes" value={ind.all.pending} />
        <Kpi label="Vencidas" value={ind.all.overdue} tone={ind.all.overdue ? "bad" : "navy"} />
        <Kpi label="Tiempo estimado" value={hrs(ind.all.estimatedH)} hint={`Real ${hrs(ind.all.actualH)}`} tone="sky" />
        <Kpi label="Carga (5 días hábiles)" value={wl.level ? LEVEL_LABEL[wl.level] : "—"} hint={`${hrs(wl.pendingH)} de ${hrs(wl.availableH)} disponibles`} tone={wl.level === "sobrecarga" ? "bad" : wl.level === "alta" ? "warn" : "ok"} />
      </div>

      <Card className="mt-4">
        <CardHeader title="Cumplimiento individual" subtitle="Habituales y extraordinarias se miden por separado" />
        <div className="grid gap-3 p-4 lg:grid-cols-3">
          <IndicatorBlock title="Habituales" b={ind.habitual} tone="navy" />
          <IndicatorBlock title="Extraordinarias" b={ind.extraordinaria} tone="sky" />
          <IndicatorBlock title={m.isAdmin ? "Personales" : "De proyecto"} b={m.isAdmin ? ind.personal : ind.proyecto} />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Semanal" subtitle="Esfuerzo ponderado completado, últimas 8 semanas" /><div className="p-2"><OriginSeriesChart data={ind.series.weekly} showPersonal={m.isAdmin} /></div></Card>
        <Card><CardHeader title="Mensual" subtitle="Últimos 6 meses" /><div className="p-2"><OriginSeriesChart data={ind.series.monthly} showPersonal={m.isAdmin} /></div></Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Actividades" />
          <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2 text-xs">
            {[["abiertas", "Abiertas"], ["vencidas", "Vencidas"], ["completadas", "Completadas"], ["habitual", "Habituales"], ["extraordinaria", "Extraordinarias"]].map(([k, l]) => (
              <Link key={k} href={`?tipo=${k}`} className={`rounded-md px-2.5 py-1 ${tab === k ? "bg-navy-800 text-white" : "text-slate-600 hover:bg-surface"}`}>{l}</Link>
            ))}
          </div>
          {list.length ? (
            <ul className="divide-y divide-line">
              {list.map((a) => (
                <li key={a.assignmentId} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <Link href={`/actividades/${a.activityId}`} className="min-w-0 flex-1 truncate text-[13px] font-medium text-navy-900 hover:underline">{a.title}</Link>
                  <OriginBadge origin={a.origin} />
                  <StatusBadge status={a.status} overdue={a.overdue} />
                  <span className="tabular w-16 text-right text-2xs text-slate-500">{fmtDate(a.dueDate)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty title="Sin actividades en esta vista" />}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Actividades habituales" subtitle="Plantillas recurrentes; el sistema genera cada instancia" />
            <ul className="divide-y divide-line">
              {d.routines.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-4 py-2 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <p className={r.isActive ? "text-navy-900" : "text-slate-400 line-through"}>{r.title}</p>
                    <p className="text-2xs text-slate-500">{r.frequency === "diaria" ? "Diaria (L–V)" : r.frequency === "semanal" ? `Cada ${WEEKDAYS[(r.weekday ?? 1) - 1].toLowerCase()}` : `Día ${r.dayOfMonth} de cada mes`} · {hrs(Number(r.estimatedH))}</p>
                  </div>
                  {isAdmin && (
                    <ActionForm action={toggleRoutineAction}><input type="hidden" name="routineId" value={r.id} /><Submit variant="ghost" className="!px-2 !py-1 !text-2xs">{r.isActive ? "Pausar" : "Reactivar"}</Submit></ActionForm>
                  )}
                </li>
              ))}
              {!d.routines.length && <li className="px-4 py-3 text-xs text-slate-500">Sin actividades habituales.</li>}
            </ul>
            {isAdmin && (
              <ActionForm action={addRoutineAction} resetOnOk className="grid grid-cols-2 gap-2 border-t border-line px-4 py-3">
                <input type="hidden" name="memberId" value={id} />
                <Input name="title" placeholder="Ej. Ronda de inspección de jigs" required minLength={3} className="col-span-2 !mt-0 !py-1.5" />
                <Select name="frequency" options={[{ value: "diaria", label: "Diaria (L–V)" }, { value: "semanal", label: "Semanal" }, { value: "mensual", label: "Mensual" }]} className="!mt-0 !py-1.5" />
                <Select name="weekday" placeholder="Día (semanal)" options={WEEKDAYS.map((w, i) => ({ value: String(i + 1), label: w }))} className="!mt-0 !py-1.5" />
                <Input name="dayOfMonth" type="number" min="1" max="31" placeholder="Día del mes" className="!mt-0 !py-1.5" />
                <Input name="estimatedH" type="number" step="0.25" min="0.25" placeholder="Horas" required className="!mt-0 !py-1.5" />
                <Select name="priority" defaultValue="media" options={opts(PRIORITY_LABEL)} className="!mt-0 !py-1.5" />
                <Select name="complexity" defaultValue="2" options={["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: `Complejidad ${v}` }))} className="!mt-0 !py-1.5" />
                <Submit variant="soft" className="col-span-2">Agregar actividad habitual</Submit>
              </ActionForm>
            )}
          </Card>

          <Card>
            <CardHeader title="Responsabilidades" />
            <p className="whitespace-pre-wrap px-4 py-3 text-[13px] text-slate-700">{m.responsibilities || "—"}</p>
          </Card>

          <Card>
            <CardHeader title="Proyectos relacionados" />
            <ul className="space-y-1 px-4 py-3 text-[13px]">
              {d.projects.map((p) => <li key={p.id} className="flex justify-between gap-2"><Link href={`/proyectos/${p.id}`} className="truncate text-navy-900 hover:underline">{p.name}</Link><span className="text-2xs text-slate-500">{PROJECT_STATUS_LABEL[p.status]}</span></li>)}
              {!d.projects.length && <li className="text-xs text-slate-500">—</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Turnos y ausencias" />
            <ul className="space-y-1 px-4 py-3 text-xs text-slate-600">
              {d.shifts.slice(0, 6).map((s) => <li key={s.id}>Semana {fmtDate(s.weekStart)}: <span className="text-navy-900">{SHIFT_LABEL[s.kind]}</span></li>)}
              {d.timeOff.map((t) => <li key={t.id}>Ausencia {fmtDate(t.dateFrom)} – {fmtDate(t.dateTo)}{t.reason ? ` · ${t.reason}` : ""}</li>)}
              {!d.shifts.length && !d.timeOff.length && <li>Sin turnos asignados. Se supone turno de día.</li>}
            </ul>
            {isAdmin && (
              <ActionForm action={timeOffAction} resetOnOk className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
                <input type="hidden" name="memberId" value={id} />
                <label className="text-2xs text-slate-500">Desde<Input type="date" name="dateFrom" required className="!py-1.5" /></label>
                <label className="text-2xs text-slate-500">Hasta<Input type="date" name="dateTo" required className="!py-1.5" /></label>
                <Input name="reason" placeholder="Motivo (vacaciones, curso…)" className="!mt-0 min-w-[140px] flex-1 !py-1.5" />
                <Submit variant="soft">Registrar ausencia</Submit>
              </ActionForm>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Evidencias registradas" /><EvidenceList items={d.evidence} tz={tz} /></Card>
        <Card><CardHeader title="Historial de actividades" subtitle="Línea cronológica" /><Timeline items={log} tz={tz} /></Card>
      </div>
    </>
  );
}
