import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { rotateShiftsAction, setShiftAction } from "@/app/(app)/actions";
import { LoadBadge } from "@/components/badges";
import { ActionForm, Submit } from "@/components/forms";
import { LinkButton, PageHeader, Select } from "@/components/fields";
import { Card, CardHeader, Empty, Insufficient, Progress } from "@/components/ui";
import { fmtDate, hrs, SHIFT_LABEL } from "@/lib/format";
import { ctx } from "@/server/context";
import { teamIndicators } from "@/server/services/indicators";
import { ensureRoutinesGenerated, listMembers, shiftBoard } from "@/server/services/members";

export const metadata = { title: "Mi equipo" };

export default async function TeamPage() {
  const c = await ctx("activity.view");
  await ensureRoutinesGenerated(c);
  const [members, ind, board] = await Promise.all([listMembers(c, { includeInactive: true }), teamIndicators(c), shiftBoard(c, 6)]);
  const byId = new Map(ind.rows.map((r) => [r.id, r]));
  return (
    <>
      <PageHeader icon={Users} title="Mi equipo" subtitle={`${members.filter((m) => m.isActive).length} colaboradores activos`} actions={c.scope === "all" && <LinkButton href="/equipo/nuevo"><Plus className="h-4 w-4" />Registrar colaborador</LinkButton>} />
      {members.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => {
            const r = byId.get(m.id);
            return (
              <Link key={m.id} href={`/equipo/${m.id}`}>
                <Card className={`h-full p-4 transition hover:shadow-sm ${m.isActive ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-navy-900">{m.fullName}</p>
                      <p className="text-2xs text-slate-500">{[m.position, m.area].filter(Boolean).join(" · ") || "Sin puesto"}{m.internalCode ? ` · ${m.internalCode}` : ""}</p>
                    </div>
                    {r ? <LoadBadge level={r.workload.level} /> : <span className="text-2xs text-slate-400">Inactivo</span>}
                  </div>
                  {r && (
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-2xs uppercase tracking-wide text-slate-500">Habituales</p>
                          <div className="mt-1 flex items-center gap-2"><Progress value={r.habitual.completion} tone="ok" /><span className="tabular w-10 text-right">{r.habitual.completion == null ? "—" : `${r.habitual.completion}%`}</span></div>
                          <p className="mt-0.5 text-2xs text-slate-500">{r.habitual.completed}/{r.habitual.total} · {r.habitual.overdue} vencidas</p>
                        </div>
                        <div>
                          <p className="text-2xs uppercase tracking-wide text-slate-500">Extraordinarias</p>
                          <div className="mt-1 flex items-center gap-2"><Progress value={r.extraordinaria.completion} tone="sky" /><span className="tabular w-10 text-right">{r.extraordinaria.completion == null ? "—" : `${r.extraordinaria.completion}%`}</span></div>
                          <p className="mt-0.5 text-2xs text-slate-500">{r.extraordinaria.completed}/{r.extraordinaria.total} · {r.extraordinaria.overdue} vencidas</p>
                        </div>
                      </div>
                      <p className="mt-3 text-2xs text-slate-500">
                        Turno esta semana: {SHIFT_LABEL[r.workload.shiftThisWeek]}{r.workload.shiftAssumed ? " (sin asignar, se supone día)" : ""} · {hrs(r.workload.pendingH)} pendientes de {hrs(r.workload.availableH)} disponibles
                      </p>
                      <p className="mt-1 text-2xs text-slate-500">Entregas a tiempo: {r.all.onTime == null ? <Insufficient small /> : `${r.all.onTime}%`}</p>
                    </>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card><Empty icon={Users} title="Aún no registras colaboradores" text="Registra a las tres personas de tu equipo con su perfil laboral." action={<Link href="/equipo/nuevo" className="text-xs font-medium text-sky-600 hover:underline">Registrar colaborador</Link>} /></Card>
      )}

      {board.members.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Rotación de turnos" subtitle="Lunes a viernes · día 12 h, noche 8 h (editable en Configuración). Define la disponibilidad para calcular la carga." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-2xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-line"><th className="px-4 py-2 font-medium">Persona</th>{board.cols.map((w) => <th key={w} className="px-2 py-2 font-medium">Sem. {fmtDate(w)}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {board.members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 font-medium text-navy-900">{m.name}</td>
                    {m.shifts.map((s, i) => (
                      <td key={i} className="px-2 py-1.5">
                        {c.scope === "all" ? (
                          <ActionForm action={setShiftAction} className="flex items-center gap-1">
                            <input type="hidden" name="memberId" value={m.id} />
                            <input type="hidden" name="weekStart" value={board.cols[i]} />
                            <Select name="kind" defaultValue={s ?? ""} placeholder="—" options={[{ value: "dia", label: "Día" }, { value: "noche", label: "Noche" }, { value: "descanso", label: "Descanso" }]} className="!mt-0 !w-24 !px-1.5 !py-1 !text-xs" />
                            <Submit variant="ghost" className="!px-1.5 !py-1 !text-2xs" title="Guardar">✓</Submit>
                          </ActionForm>
                        ) : (
                          <span>{s ? SHIFT_LABEL[s] : "—"}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {c.scope === "all" && (
            <ActionForm action={rotateShiftsAction} className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
              <p className="w-full text-2xs font-medium uppercase tracking-wide text-slate-500">Generar rotación semanal automática</p>
              <Select name="memberId" options={board.members.map((m) => ({ value: m.id, label: m.name }))} className="!mt-0 !w-48 !py-1.5" />
              <input type="date" name="weekStart" defaultValue={board.cols[0]} className="rounded-lg border border-line px-2 py-1.5 text-[13px]" />
              <Select name="first" options={[{ value: "dia", label: "Empieza en día" }, { value: "noche", label: "Empieza en noche" }]} className="!mt-0 !w-40 !py-1.5" />
              <Select name="weeks" defaultValue="8" options={["4", "8", "12", "26"].map((v) => ({ value: v, label: `${v} semanas` }))} className="!mt-0 !w-32 !py-1.5" />
              <Submit variant="soft">Generar</Submit>
            </ActionForm>
          )}
        </Card>
      )}
    </>
  );
}
