import Link from "next/link";
import clsx from "clsx";
import { FileText, Paperclip } from "lucide-react";
import { deleteEvidenceAction, uploadEvidenceAction } from "@/app/(app)/evidence-actions";
import { ActionForm, Submit } from "@/components/forms";
import { FilterBar, Input, MiniSelect, PageHeader, Select } from "@/components/fields";
import { Timeline } from "@/components/Timeline";
import { Card, CardHeader, Empty } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { ctx } from "@/server/context";
import { activityOptions } from "@/server/services/activities";
import { listEvidence } from "@/server/services/evidence";
import { ACCEPT_ATTR } from "@/server/services/evidence-rules";
import { timeline } from "@/server/services/logbook";
import { memberOptions } from "@/server/services/members";
import { projectOptions } from "@/server/services/projects";
import { getSetting } from "@/server/services/settings";

export const metadata = { title: "Evidencias y bitácora" };

export default async function EvidencePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await ctx("evidence.view");
  const tz = await getSetting("timezone");
  const tab = sp.vista === "bitacora" ? "bitacora" : "galeria";
  const [members, projects, activities] = await Promise.all([memberOptions(c), projectOptions(c), activityOptions(c)]);
  const items = tab === "galeria" ? await listEvidence(c, { projectId: sp.proyecto, memberId: sp.persona, type: sp.clase, from: sp.desde, to: sp.hasta }) : [];
  const log = tab === "bitacora" ? await timeline(c, { projectId: sp.proyecto, memberId: sp.persona, from: sp.desde, to: sp.hasta, limit: 300 }) : [];
  const q = (v: string) => `?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([, x]) => x)) as Record<string, string>), vista: v })}`;

  return (
    <>
      <PageHeader icon={Paperclip} title="Evidencias y bitácora" subtitle="Repositorio central y línea cronológica automática" />
      <div className="mb-4 inline-flex rounded-lg border border-line p-0.5 text-[13px]">
        <Link href={q("galeria")} className={clsx("rounded-md px-3 py-1.5", tab === "galeria" ? "bg-navy-800 text-white" : "text-slate-600")}>Galería</Link>
        <Link href={q("bitacora")} className={clsx("rounded-md px-3 py-1.5", tab === "bitacora" ? "bg-navy-800 text-white" : "text-slate-600")}>Bitácora</Link>
      </div>
      <FilterBar>
        <input type="hidden" name="vista" value={tab} />
        <MiniSelect label="Proyecto" name="proyecto" value={sp.proyecto} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <MiniSelect label="Responsable" name="persona" value={sp.persona} options={members.map((m) => ({ value: m.id, label: m.isAdmin ? `${m.name} (yo)` : m.name }))} />
        {tab === "galeria" && <MiniSelect label="Clase" name="clase" value={sp.clase} options={[{ value: "imagen", label: "Fotos y capturas" }, { value: "documento", label: "Documentos y archivos" }]} />}
        <label className="block"><span className="text-2xs font-medium uppercase tracking-wide text-slate-500">Desde</span><Input type="date" name="desde" defaultValue={sp.desde} className="!py-1.5" /></label>
        <label className="block"><span className="text-2xs font-medium uppercase tracking-wide text-slate-500">Hasta</span><Input type="date" name="hasta" defaultValue={sp.hasta} className="!py-1.5" /></label>
      </FilterBar>

      {tab === "galeria" ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader title={`${items.length} evidencias`} />
            {items.length ? (
              <ul className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ e, activityTitle, projectName, memberName }) => (
                  <li key={e.id} className="overflow-hidden rounded-lg border border-line">
                    <a href={`/api/v1/evidence/${e.id}`} target="_blank" rel="noopener" className="block aspect-video bg-surface">
                      {e.mime.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/v1/evidence/${e.id}`} alt={e.description ?? e.originalName} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full place-items-center"><FileText className="h-8 w-8 text-slate-300" /><span className="sr-only">{e.originalName}</span></span>
                      )}
                    </a>
                    <div className="space-y-0.5 p-2.5 text-2xs text-slate-500">
                      <p className="truncate text-xs font-medium text-navy-900">{e.originalName}</p>
                      {e.description && <p className="truncate text-slate-600">{e.description}</p>}
                      <p className="truncate">{projectName ?? "Sin proyecto"}{activityTitle ? ` · ${activityTitle}` : ""}</p>
                      <p>{memberName ?? "—"} · {fmtDateTime(e.createdAt, tz)} · {(e.sizeBytes / 1024).toFixed(0)} KB</p>
                      <div className="flex items-center justify-between pt-1">
                        <a href={`/api/v1/evidence/${e.id}?descargar=1`} className="text-sky-600 hover:underline">Descargar</a>
                        {c.scope === "all" && (
                          <ActionForm action={deleteEvidenceAction} confirm="¿Eliminar esta evidencia?"><input type="hidden" name="id" value={e.id} /><Submit variant="ghost" className="!px-1.5 !py-0.5 !text-2xs">Eliminar</Submit></ActionForm>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty icon={Paperclip} title="Sin evidencias con estos filtros" />}
          </Card>
          <Card>
            <CardHeader title="Subir evidencia" subtitle="Fotos, PDF, Excel, Word, capturas y archivos de programación" />
            <ActionForm action={uploadEvidenceAction} resetOnOk className="space-y-2 p-4">
              <input type="file" name="file" required accept={ACCEPT_ATTR} className="block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-navy-50 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-navy-800" />
              <Select name="activityId" placeholder="Actividad (opcional)" options={activities.map((a) => ({ value: a.id, label: a.title }))} className="!py-1.5" />
              <Select name="projectId" placeholder="Proyecto (opcional)" options={projects.map((p) => ({ value: p.id, label: p.name }))} className="!py-1.5" />
              <Select name="memberId" placeholder="Responsable" options={members.map((m) => ({ value: m.id, label: m.isAdmin ? `${m.name} (yo)` : m.name }))} className="!py-1.5" />
              <Input name="description" placeholder="Descripción" className="!py-1.5" />
              <Submit>Subir</Submit>
              <p className="text-2xs text-slate-500">Se verifica tipo y contenido real del archivo. Máximo 50 MB en la laptop y 4 MB en Vercel.</p>
            </ActionForm>
          </Card>
        </div>
      ) : (
        <Card className="mt-4">
          <CardHeader title="Bitácora automática" subtitle="Creación, asignación, inicio, término, cambios de fecha y prioridad, comentarios y evidencias" />
          <Timeline items={log} tz={tz} />
        </Card>
      )}
    </>
  );
}
