import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, Sparkles } from "lucide-react";
import {
  approveDayPlanAction, approvePlanAction, approveRescheduleAction, rejectProposalAction, useInstructionAction,
} from "@/app/(app)/more-actions";
import { PriorityBadge } from "@/components/badges";
import { ActionForm, Submit } from "@/components/forms";
import { Input, PageHeader } from "@/components/fields";
import { Badge, Card, CardHeader } from "@/components/ui";
import { fmtDate, fmtDateTime, ORIGIN_LABEL, PRIORITY_LABEL } from "@/lib/format";
import type { DayPlan, Instruction, Plan } from "@/ai/schemas";
import { ctx } from "@/server/context";
import { getProposal } from "@/server/services/ai";
import { memberOptions } from "@/server/services/members";
import { projectOptions } from "@/server/services/projects";
import { getSetting } from "@/server/services/settings";

export const metadata = { title: "Propuesta de IA" };

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx("ai.use");
  const p = await getProposal(c, id);
  const tz = await getSetting("timezone");
  const [members, projects] = await Promise.all([memberOptions(c), projectOptions(c)]);
  const open = p.status === "pendiente";
  const team = members.filter((m) => !m.isAdmin);

  const Reject = () =>
    open ? (
      <ActionForm action={rejectProposalAction}>
        <input type="hidden" name="proposalId" value={id} />
        <Submit variant="soft">Rechazar</Submit>
      </ActionForm>
    ) : null;

  return (
    <>
      <Link href="/asistente" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-navy-900"><ArrowLeft className="h-3.5 w-3.5" />Asistente IA</Link>
      <PageHeader
        icon={Sparkles}
        title="Vista previa para aprobación"
        subtitle={`Solicitado ${fmtDateTime(p.createdAt, tz)}`}
        actions={<Badge tone={open ? "warn" : p.status === "aprobada" ? "ok" : "neutral"}>{open ? "Pendiente de tu aprobación" : p.status === "aprobada" ? "Aprobada" : "Rechazada"}</Badge>}
      />
      <Card className="mb-4 px-4 py-3 text-[13px] text-slate-600"><span className="text-2xs font-medium uppercase tracking-wide text-slate-500">Tu texto</span><p className="mt-1 whitespace-pre-wrap text-navy-900">{p.prompt}</p></Card>

      {p.kind === "checklist" && (() => {
        const plan = p.payload as Plan;
        const flat = plan.phases.flatMap((ph) => ph.activities.map((a) => ({ phase: ph.name, a })));
        const projName = plan.projectId ? projects.find((x) => x.id === plan.projectId)?.name : null;
        return (
          <ActionForm action={approvePlanAction} className="space-y-4">
            <input type="hidden" name="proposalId" value={id} />
            <input type="hidden" name="count" value={flat.length} />
            <Card>
              <CardHeader title={plan.source === "ia" ? "Plan generado por IA" : "Desglose básico (sin IA)"} subtitle={plan.objective ? `Objetivo: ${plan.objective}` : undefined} />
              <div className="grid gap-3 px-4 py-3 md:grid-cols-2">
                {projName ? (
                  <p className="text-[13px]">Se agregará al proyecto <b>{projName}</b>.</p>
                ) : (
                  <label className="text-xs text-slate-600">Nombre del proyecto nuevo<Input name="projectName" defaultValue={plan.project.name} disabled={!open} /></label>
                )}
                {(plan.risks.length > 0 || plan.deliverables.length > 0) && (
                  <div className="text-xs text-slate-600">
                    {plan.deliverables.length > 0 && <p><b className="text-navy-900">Entregables:</b> {plan.deliverables.join(" · ")}</p>}
                    {plan.risks.length > 0 && <p className="mt-1 flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn-500" /><span><b className="text-navy-900">Riesgos:</b> {plan.risks.join(" · ")}</span></p>}
                  </div>
                )}
              </div>
            </Card>
            {plan.phases.map((ph) => (
              <Card key={ph.name}>
                <CardHeader title={ph.name} subtitle={`${ph.activities.length} actividades`} />
                <ul className="divide-y divide-line">
                  {flat.map(({ phase, a }, i) =>
                    phase !== ph.name ? null : (
                      <li key={i} className="grid gap-2 px-4 py-3 md:grid-cols-[24px_1fr_170px_120px_120px_80px] md:items-center">
                        <input type="checkbox" name={`inc_${i}`} defaultChecked disabled={!open} className="h-4 w-4" aria-label="Incluir" />
                        <div>
                          <Input name={`title_${i}`} defaultValue={a.title} disabled={!open} className="!mt-0 !py-1.5 font-medium" />
                          <p className="mt-1 flex flex-wrap gap-1.5 text-2xs text-slate-500">
                            <PriorityBadge priority={a.priority} /> Complejidad {a.complexity}
                            {a.deliverable ? ` · Entregable: ${a.deliverable}` : ""}
                            {a.dependsOn?.length ? ` · Depende de: ${a.dependsOn.join(", ")}` : ""}
                          </p>
                        </div>
                        <select name={`member_${i}`} defaultValue={a.memberId ?? ""} disabled={!open} className="rounded-lg border border-line px-2 py-1.5 text-xs">
                          <option value="">Yo (personal)</option>
                          {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <input type="date" name={`start_${i}`} defaultValue={a.startDate ?? ""} disabled={!open} className="rounded-lg border border-line px-2 py-1.5 text-xs" aria-label="Inicio" />
                        <input type="date" name={`due_${i}`} defaultValue={a.dueDate ?? ""} disabled={!open} className="rounded-lg border border-line px-2 py-1.5 text-xs" aria-label="Fecha límite" />
                        <input type="number" step="0.25" min="0" name={`est_${i}`} defaultValue={a.estimatedH} disabled={!open} className="rounded-lg border border-line px-2 py-1.5 text-xs" aria-label="Horas" />
                      </li>
                    ),
                  )}
                </ul>
              </Card>
            ))}
            {open && (
              <div className="flex flex-wrap items-center gap-2">
                <Submit><Check className="h-4 w-4" />Aprobar y crear</Submit>
                <span className="text-2xs text-slate-500">Las asignadas a un colaborador se registran como extraordinarias; las tuyas, como personales. Revisa la carga del equipo después en Asignaciones.</span>
              </div>
            )}
          </ActionForm>
        );
      })()}

      {p.kind === "asignacion" && (() => {
        const ins = p.payload as Instruction;
        const who = ins.memberIds.map((m) => members.find((x) => x.id === m)?.name).filter(Boolean);
        return (
          <Card>
            <CardHeader title={ins.source === "ia" ? "Interpretación de la IA" : "Interpretación básica (sin IA)"} />
            <dl className="grid gap-x-6 gap-y-3 px-4 py-4 text-[13px] sm:grid-cols-3">
              {[
                ["Actividad nueva", ins.title],
                ["Responsable", who.length ? who.join(", ") : ins.memberNames.length ? `${ins.memberNames.join(", ")} (no encontrado)` : "Tú"],
                ["Proyecto relacionado", projects.find((x) => x.id === ins.projectId)?.name ?? ins.projectName ?? "—"],
                ["Fecha sugerida", fmtDate(ins.dueDate)],
                ["Prioridad", PRIORITY_LABEL[ins.priority]],
                ["Tipo", ORIGIN_LABEL[ins.origin]],
              ].map(([k, v]) => <div key={k}><dt className="text-2xs uppercase tracking-wide text-slate-500">{k}</dt><dd className="mt-0.5 text-navy-900">{v}</dd></div>)}
            </dl>
            {open && (
              <div className="flex gap-2 border-t border-line px-4 py-3">
                <ActionForm action={useInstructionAction}><input type="hidden" name="proposalId" value={id} /><Submit>Revisar en el formulario</Submit></ActionForm>
                <Reject />
              </div>
            )}
          </Card>
        );
      })()}

      {p.kind === "plan_dia" && (() => {
        const plan = p.payload as DayPlan;
        return (
          <ActionForm action={approveDayPlanAction}>
            <input type="hidden" name="proposalId" value={id} />
            <input type="hidden" name="count" value={plan.blocks.length} />
            <Card>
              <CardHeader title={`Horario propuesto · ${fmtDate(plan.date, { weekday: "long", day: "numeric", month: "long" })}`} subtitle={plan.source === "ia" ? plan.notes ?? undefined : "Distribución básica sin IA"} />
              <ul className="divide-y divide-line">
                {plan.blocks.map((b, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <input type="checkbox" name={`inc_${i}`} defaultChecked disabled={!open} className="h-4 w-4" />
                    <span className="tabular w-28 text-xs text-slate-500">{b.start}–{b.end}</span>
                    <span className={`text-[13px] ${b.title === "Descanso" ? "text-slate-400" : "text-navy-900"}`}>{b.title}</span>
                    {b.activityId ? <Badge tone="navy">Actividad existente</Badge> : b.title !== "Descanso" && <Badge>Nueva personal</Badge>}
                  </li>
                ))}
              </ul>
              {open && <div className="border-t border-line px-4 py-3"><Submit><Check className="h-4 w-4" />Aceptar horario</Submit></div>}
            </Card>
          </ActionForm>
        );
      })()}

      {p.kind === "reprogramacion" && (() => {
        const r = p.payload as { summary: string; items: { activityId: string; title: string; from: string | null; to: string }[] };
        return (
          <ActionForm action={approveRescheduleAction}>
            <input type="hidden" name="proposalId" value={id} />
            <input type="hidden" name="count" value={r.items.length} />
            <Card>
              <CardHeader title="Reprogramación propuesta" subtitle={r.summary} />
              <ul className="divide-y divide-line">
                {r.items.map((it, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                    <input type="checkbox" name={`inc_${i}`} defaultChecked disabled={!open} className="h-4 w-4" />
                    <Link href={`/actividades/${it.activityId}`} className="flex-1 text-navy-900 hover:underline">{it.title}</Link>
                    <span className="tabular text-xs text-slate-500">{fmtDate(it.from)} → <b className="text-navy-900">{fmtDate(it.to)}</b></span>
                  </li>
                ))}
              </ul>
              {open && <div className="border-t border-line px-4 py-3"><Submit><Check className="h-4 w-4" />Aplicar reprogramación</Submit></div>}
            </Card>
          </ActionForm>
        );
      })()}

      {open && p.kind !== "asignacion" && <div className="mt-3"><Reject /></div>}
    </>
  );
}
