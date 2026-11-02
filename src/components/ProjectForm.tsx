import { saveProjectAction } from "@/app/(app)/actions";
import { ActionForm, Submit } from "@/components/forms";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/fields";
import { opts, PRIORITY_LABEL, PROJECT_STATUS_LABEL } from "@/lib/format";

type P = {
  id?: string; name?: string; description?: string | null; objective?: string | null; category?: string | null; ownerMemberId?: string | null;
  priority?: string; status?: string; startDate?: string | null; dueDate?: string | null; finishedAt?: string | null; budget?: string | null; notes?: string | null;
};

export function ProjectForm({ p = {}, members, memberIds = [] }: { p?: P; members: { id: string; name: string; isAdmin: boolean }[]; memberIds?: string[] }) {
  return (
    <ActionForm action={saveProjectAction} className="space-y-5">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" className="md:col-span-2"><Input name="name" required minLength={3} defaultValue={p.name} placeholder="Ej. Mejora de estación de soldadura" /></Field>
        <Field label="Descripción" className="md:col-span-2"><Textarea name="description" defaultValue={p.description ?? ""} /></Field>
        <Field label="Objetivo" className="md:col-span-2"><Textarea name="objective" rows={2} defaultValue={p.objective ?? ""} /></Field>
        <Field label="Categoría"><Input name="category" defaultValue={p.category ?? ""} placeholder="Automatización, calidad, mantenimiento…" /></Field>
        <Field label="Responsable principal">
          <Select name="ownerMemberId" defaultValue={p.ownerMemberId ?? members.find((m) => m.isAdmin)?.id} options={members.map((m) => ({ value: m.id, label: m.isAdmin ? `${m.name} (yo)` : m.name }))} />
        </Field>
        <Field label="Prioridad"><Select name="priority" defaultValue={p.priority ?? "media"} options={opts(PRIORITY_LABEL)} /></Field>
        <Field label="Estado"><Select name="status" defaultValue={p.status ?? "en_planificacion"} options={opts(PROJECT_STATUS_LABEL)} /></Field>
        <Field label="Fecha de inicio"><Input type="date" name="startDate" defaultValue={p.startDate ?? ""} /></Field>
        <Field label="Fecha estimada de finalización"><Input type="date" name="dueDate" defaultValue={p.dueDate ?? ""} /></Field>
        <Field label="Fecha real de finalización" hint="Se llena sola al marcar Completado."><Input type="date" name="finishedAt" defaultValue={p.finishedAt ?? ""} /></Field>
        <Field label="Presupuesto (opcional, MXN)"><Input type="number" name="budget" min="0" step="0.01" defaultValue={p.budget ?? ""} /></Field>
        <Field label="Participantes" className="md:col-span-2">
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 rounded-lg border border-line p-2.5">
            {members.map((m) => <Checkbox key={m.id} name="memberIds" value={m.id} label={m.isAdmin ? `${m.name} (yo)` : m.name} defaultChecked={memberIds.includes(m.id)} />)}
          </div>
        </Field>
        <Field label="Notas" className="md:col-span-2"><Textarea name="notes" defaultValue={p.notes ?? ""} /></Field>
      </div>
      <div className="border-t border-line pt-4"><Submit>{p.id ? "Guardar cambios" : "Crear proyecto"}</Submit></div>
    </ActionForm>
  );
}
