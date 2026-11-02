import { ActionForm, Submit, type ActionState } from "@/components/forms";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/fields";
import { ORIGIN_LABEL, opts, PRIORITY_LABEL } from "@/lib/format";

type Opt = { id: string; name: string };
export type ActivityDefaults = {
  id?: string;
  title?: string;
  description?: string | null;
  origin?: string;
  projectId?: string | null;
  phaseId?: string | null;
  parentId?: string | null;
  priority?: string;
  complexity?: number;
  estimatedH?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  evidenceRequired?: boolean;
  instructions?: string | null;
  memberIds?: string[];
  dependsOn?: string[];
  checklist?: string;
};

/**
 * Formulario único de actividades. En modo «asignar» se titula ASIGNAR NUEVA ACTIVIDAD,
 * permite elegir una o varias personas y advierte la carga antes de guardar.
 */
export function ActivityForm({
  action, defaults = {}, members, projects, phases, activities, mode, today, returnTo,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  defaults?: ActivityDefaults;
  members: (Opt & { isAdmin: boolean })[];
  projects: Opt[];
  phases: (Opt & { projectId: string })[];
  activities: { id: string; title: string }[];
  mode: "personal" | "asignar" | "editar";
  today: string;
  returnTo?: string;
}) {
  const team = members.filter((m) => !m.isAdmin);
  const origin = defaults.origin ?? (mode === "personal" ? "personal" : "extraordinaria");
  const editing = mode === "editar";
  return (
    <ActionForm action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {defaults.parentId && <input type="hidden" name="parentId" value={defaults.parentId} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre de la actividad" className="md:col-span-2">
          <Input name="title" required minLength={3} defaultValue={defaults.title} placeholder="Ej. Revisar el sensor de presencia de la celda 2" />
        </Field>
        <Field label="Descripción" className="md:col-span-2">
          <Textarea name="description" defaultValue={defaults.description ?? ""} />
        </Field>

        {mode === "personal" ? (
          <input type="hidden" name="origin" value="personal" />
        ) : (
          <Field label="Tipo de actividad" hint="Habitual = responsabilidad normal. Extraordinaria = trabajo adicional que tú asignas.">
            <Select name="origin" defaultValue={origin} options={opts(ORIGIN_LABEL).filter((o) => editing || o.value !== "personal")} />
          </Field>
        )}

        {mode !== "personal" && (
          <Field label="Colaborador(es) asignado(s)" hint="Puedes elegir varias personas; cada una tendrá su propio avance.">
            <div className="mt-1 grid gap-1.5 rounded-lg border border-line p-2.5">
              {team.length === 0 && <span className="text-xs text-slate-500">Primero registra colaboradores en Mi equipo.</span>}
              {(editing ? members : team).map((m) => (
                <Checkbox key={m.id} name="memberIds" value={m.id} label={m.isAdmin ? `${m.name} (yo)` : m.name} defaultChecked={defaults.memberIds?.includes(m.id)} />
              ))}
            </div>
          </Field>
        )}

        <Field label="Proyecto relacionado" hint="Opcional. Con proyecto, cuenta también en el avance del proyecto.">
          <Select name="projectId" defaultValue={defaults.projectId ?? ""} placeholder="Sin proyecto" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
        <Field label="Fase del proyecto">
          <Select
            name="phaseId"
            defaultValue={defaults.phaseId ?? ""}
            placeholder="Sin fase"
            options={phases.map((p) => ({ value: p.id, label: `${projects.find((x) => x.id === p.projectId)?.name ?? ""} · ${p.name}` }))}
          />
        </Field>

        <Field label="Prioridad">
          <Select name="priority" defaultValue={defaults.priority ?? "media"} options={opts(PRIORITY_LABEL)} />
        </Field>
        <Field label="Complejidad" hint="1 = rutinaria · 5 = muy compleja. Pondera los indicadores.">
          <Select name="complexity" defaultValue={String(defaults.complexity ?? 2)} options={["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v }))} />
        </Field>

        {mode === "asignar" && (
          <Field label="Fecha de asignación">
            <Input value={today} readOnly disabled />
          </Field>
        )}
        <Field label="Tiempo estimado (horas)">
          <Input name="estimatedH" type="number" min="0" step="0.25" defaultValue={defaults.estimatedH ?? ""} placeholder="Ej. 2.5" />
        </Field>
        <Field label="Fecha de inicio">
          <Input name="startDate" type="date" defaultValue={defaults.startDate ?? (editing ? "" : today)} />
        </Field>
        <Field label="Fecha límite">
          <Input name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} />
        </Field>

        <Field label="Dependencias" hint="Actividades que deben terminar antes de iniciar esta (Ctrl/⌘ para varias).">
          <select name="dependsOn" multiple defaultValue={defaults.dependsOn ?? []} className="mt-1 block h-28 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[13px]">
            {activities.filter((a) => a.id !== defaults.id).map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Instrucciones adicionales">
          <Textarea name="instructions" rows={4} defaultValue={defaults.instructions ?? ""} />
        </Field>

        {!editing && (
          <Field label="Checklist" hint="Un paso por línea." className="md:col-span-2">
            <Textarea name="checklist" rows={4} defaultValue={defaults.checklist ?? ""} placeholder={"Revisar condiciones de operación\nVerificar entradas del PLC"} />
          </Field>
        )}
        <div className="md:col-span-2">
          <Checkbox name="evidenceRequired" label="Requiere evidencia para completarse" defaultChecked={defaults.evidenceRequired} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Submit>{editing ? "Guardar cambios" : mode === "asignar" ? "Asignar actividad" : "Crear actividad"}</Submit>
      </div>
    </ActionForm>
  );
}
