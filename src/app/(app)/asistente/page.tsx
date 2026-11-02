import Link from "next/link";
import clsx from "clsx";
import { Bot, ListTree, MessageSquare, Sparkles, Sun, Wand2 } from "lucide-react";
import { proposeDayPlanAction, proposeInstructionAction, proposePlanAction } from "@/app/(app)/more-actions";
import { AssistantChat } from "@/components/AssistantChat";
import { ActionForm, Submit } from "@/components/forms";
import { PageHeader, Select, Textarea } from "@/components/fields";
import { Markdown } from "@/components/Markdown";
import { Badge, Card, CardHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { aiStatus } from "@/ai/provider";
import { ctx } from "@/server/context";
import { recentProposals } from "@/server/services/ai";
import { projectOptions } from "@/server/services/projects";
import { getSetting } from "@/server/services/settings";

export const metadata = { title: "Asistente IA" };
const KIND: Record<string, string> = { checklist: "Desglose de proyecto", asignacion: "Instrucción", plan_dia: "Plan del día", reprogramacion: "Reprogramación" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await ctx("ai.use");
  const ai = aiStatus();
  const tz = await getSetting("timezone");
  const mode = sp.modo ?? "checklist";
  const [projects, recent, chats] = await Promise.all([projectOptions(c), recentProposals(c, ["checklist", "asignacion", "plan_dia", "reprogramacion"], 15), recentProposals(c, ["chat"], 8)]);
  const tabs = [
    ["checklist", "Generar actividades", ListTree],
    ["instruccion", "Instrucción rápida", Wand2],
    ["dia", "Planificar mi día", Sun],
    ["chat", "Preguntar", MessageSquare],
  ] as const;

  return (
    <>
      <PageHeader icon={Bot} title="Asistente IA" subtitle="La IA propone; nada se guarda ni se asigna hasta que tú lo apruebas." actions={ai.configured ? <Badge tone="ok">IA activa · {ai.provider}</Badge> : <Badge tone="warn">Sin clave de IA · modo básico</Badge>} />
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-line p-1 text-[13px]">
        {tabs.map(([k, l, Icon]) => (
          <Link key={k} href={`?modo=${k}${sp.proyecto ? `&proyecto=${sp.proyecto}` : ""}`} className={clsx("flex items-center gap-1.5 rounded-lg px-3 py-1.5", mode === k ? "bg-navy-800 text-white" : "text-slate-600 hover:bg-surface")}><Icon className="h-4 w-4" />{l}</Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="p-5">
          {mode === "checklist" && (
            <ActionForm action={proposePlanAction} className="space-y-3">
              <p className="text-[13px] text-slate-600">Describe el trabajo completo. La IA identifica el objetivo, lo divide en fases, actividades y dependencias, propone tiempos, fechas, responsables, entregables y riesgos. Después revisas y ajustas cada actividad.</p>
              <Textarea name="text" rows={7} required minLength={15} placeholder="Necesito desarrollar una mejora en una estación de soldadura. Primero debo revisar las condiciones de operación, verificar sensores, revisar el PLC, identificar las fallas, generar una propuesta de automatización, realizar modificaciones, probar el funcionamiento y documentar los resultados." />
              <label className="block text-xs text-slate-600">Agregar a un proyecto existente (opcional)
                <Select name="projectId" defaultValue={sp.proyecto ?? ""} placeholder="Crear proyecto nuevo" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
              </label>
              <Submit><Sparkles className="h-4 w-4" />Generar propuesta</Submit>
              {!ai.configured && <p className="text-2xs text-slate-500">Sin clave de IA se usa un desglose básico local (separa los pasos del texto y los agrupa en Diagnóstico, Desarrollo y Validación).</p>}
            </ActionForm>
          )}
          {mode === "instruccion" && (
            <ActionForm action={proposeInstructionAction} className="space-y-3">
              <p className="text-[13px] text-slate-600">Escribe una instrucción. Se identifican la actividad, el responsable, el proyecto, la fecha y la prioridad, y se abre el formulario prellenado para que confirmes.</p>
              <Textarea name="text" rows={3} required placeholder="Agrega una actividad para revisar el sensor de presencia y asígnasela a Juan para mañana" />
              <Submit><Wand2 className="h-4 w-4" />Interpretar</Submit>
            </ActionForm>
          )}
          {mode === "dia" && (
            <ActionForm action={proposeDayPlanAction} className="space-y-3">
              <p className="text-[13px] text-slate-600">Cuenta qué necesitas hacer hoy. Se propone un horario dentro de tu turno; puedes aceptarlo, quitar bloques o rechazarlo.</p>
              <Textarea name="text" rows={4} placeholder="Hoy necesito revisar la programación del robot, terminar el dashboard de producción, revisar las actividades de mi equipo y documentar los avances." />
              <Submit><Sun className="h-4 w-4" />Proponer horario</Submit>
            </ActionForm>
          )}
          {mode === "chat" && (
            <div className="space-y-3">
              <p className="text-[13px] text-slate-600">Responde con datos reales de la base. Cada afirmación se marca como <b>Registrado</b>, <b>Estimado</b> o <b>Recomendación</b>. Si pides cambios, recibes una propuesta para aprobar.</p>
              <AssistantChat enabled={ai.configured} />
              {chats.length > 0 && (
                <div className="mt-6 space-y-3 border-t border-line pt-4">
                  <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">Consultas recientes</p>
                  {chats.map((ch) => (
                    <details key={ch.id} className="rounded-lg border border-line p-3">
                      <summary className="cursor-pointer text-[13px] font-medium text-navy-900">{ch.prompt}<span className="ml-2 text-2xs font-normal text-slate-500">{fmtDateTime(ch.createdAt, tz)}</span></summary>
                      <div className="mt-2"><Markdown text={(ch.payload as { answer: string }).answer} /></div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Propuestas recientes" />
          <ul className="divide-y divide-line">
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={`/asistente/propuesta/${p.id}`} className="block px-4 py-2.5 hover:bg-surface">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs font-medium uppercase tracking-wide text-slate-500">{KIND[p.kind] ?? p.kind}</span>
                    <Badge tone={p.status === "pendiente" ? "warn" : p.status === "aprobada" ? "ok" : "neutral"}>{p.status}</Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-navy-900">{p.prompt}</p>
                  <p className="text-2xs text-slate-500">{fmtDateTime(p.createdAt, tz)}</p>
                </Link>
              </li>
            ))}
            {!recent.length && <li className="px-4 py-3 text-xs text-slate-500">Aún no hay propuestas.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
