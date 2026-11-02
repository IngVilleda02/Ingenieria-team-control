import { Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { createActivityAction } from "@/app/(app)/actions";
import { ActivityForm, type ActivityDefaults } from "@/components/ActivityForm";
import { LoadBadge } from "@/components/badges";
import { PageHeader } from "@/components/fields";
import { Badge, Card, CardHeader } from "@/components/ui";
import { hrs } from "@/lib/format";
import type { Instruction } from "@/ai/schemas";
import { ctx } from "@/server/context";
import { formOptions } from "@/server/options";
import { getProposal } from "@/server/services/ai";
import { memberWorkload } from "@/server/services/workload";

export const metadata = { title: "Asignar nueva actividad" };

export default async function AssignNew({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await ctx("activity.assign");
  const o = await formOptions(c);
  let defaults: ActivityDefaults = { memberIds: sp.persona ? [sp.persona] : [], projectId: sp.proyecto, parentId: sp.padre, dueDate: sp.fecha, startDate: sp.fecha };
  let fromAi: Instruction | null = null;
  if (sp.propuesta) {
    const p = await getProposal(c, sp.propuesta);
    if (p.kind === "asignacion") {
      fromAi = p.payload as Instruction;
      defaults = { title: fromAi.title, description: fromAi.description, memberIds: fromAi.memberIds, projectId: fromAi.projectId, dueDate: fromAi.dueDate, startDate: fromAi.startDate ?? o.today, priority: fromAi.priority, estimatedH: fromAi.estimatedH ?? null, origin: fromAi.origin === "personal" ? "extraordinaria" : fromAi.origin };
    }
  }
  const team = o.members.filter((m) => !m.isAdmin);
  const loads = await Promise.all(team.map((m) => memberWorkload(c, m.id)));
  return (
    <>
      <PageHeader icon={UserPlus} title="ASIGNAR NUEVA ACTIVIDAD" subtitle="Aparecerá en tu dashboard, en el perfil del colaborador, en el calendario, en la lista de actividades y en el proyecto." />
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Card className="p-5">
          {fromAi && (
            <p className="mb-4 flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-600">
              <Sparkles className="h-4 w-4" />Prellenado desde tu instrucción {fromAi.source === "ia" ? "por IA" : "con el intérprete básico"}. Revisa y ajusta antes de asignar; nada se guarda hasta que confirmes.
            </p>
          )}
          <ActivityForm action={createActivityAction} mode="asignar" {...o} defaults={defaults} />
        </Card>
        <div className="space-y-3">
          <Card>
            <CardHeader title="Carga actual del equipo" subtitle="Próximos 5 días hábiles según su turno" />
            <ul className="divide-y divide-line">
              {team.map((m, i) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium text-navy-900">{m.name}</span><LoadBadge level={loads[i].level} /></div>
                  <p className="mt-1 text-2xs text-slate-500">{hrs(loads[i].pendingH)} pendientes de {hrs(loads[i].availableH)} · hoy y mañana: {hrs(loads[i].next24.pendingH)} de {hrs(loads[i].next24.availableH)}</p>
                  <p className="text-2xs text-slate-500">{loads[i].priorityCount} prioritarias · {loads[i].extraordinaryCount} extraordinarias · {loads[i].overdueCount} vencidas</p>
                </li>
              ))}
              {!team.length && <li className="px-4 py-3 text-xs text-slate-500">Sin colaboradores. <Link href="/equipo/nuevo" className="text-sky-600 hover:underline">Registrar</Link></li>}
            </ul>
          </Card>
          <Card className="px-4 py-3 text-xs text-slate-600">
            <Badge tone="warn">Alerta de carga</Badge>
            <p className="mt-2">Si la asignación deja a alguien en carga alta o sobrecarga, o con más horas pendientes que disponibles para hoy y mañana, el sistema te avisa y pide confirmación antes de guardar.</p>
            <Link href="/asistente?modo=instruccion" className="mt-2 inline-flex items-center gap-1 text-sky-600 hover:underline"><Sparkles className="h-3.5 w-3.5" />Escribirla en lenguaje natural</Link>
          </Card>
        </div>
      </div>
    </>
  );
}
