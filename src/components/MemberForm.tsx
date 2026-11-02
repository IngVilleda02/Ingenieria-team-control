import { saveMemberAction } from "@/app/(app)/actions";
import { ActionForm, Submit } from "@/components/forms";
import { Checkbox, Field, Input, Textarea } from "@/components/fields";

type M = { id?: string; fullName?: string; internalCode?: string | null; position?: string | null; area?: string | null; specialty?: string | null; responsibilities?: string | null; joinedAt?: string; isActive?: boolean; isAdmin?: boolean };

export function MemberForm({ m = {}, today }: { m?: M; today: string }) {
  return (
    <ActionForm action={saveMemberAction} className="space-y-5">
      {m.id && <input type="hidden" name="id" value={m.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre completo" className="md:col-span-2"><Input name="fullName" required minLength={3} defaultValue={m.fullName} /></Field>
        <Field label="Identificador interno" hint="Número de empleado o clave."><Input name="internalCode" defaultValue={m.internalCode ?? ""} /></Field>
        <Field label="Puesto"><Input name="position" defaultValue={m.position ?? ""} placeholder="Técnico de mantenimiento, ingeniero…" /></Field>
        <Field label="Área"><Input name="area" defaultValue={m.area ?? ""} /></Field>
        <Field label="Especialidad"><Input name="specialty" defaultValue={m.specialty ?? ""} placeholder="PLC, robots Fanuc, soldadura…" /></Field>
        <Field label="Descripción de responsabilidades" className="md:col-span-2"><Textarea name="responsibilities" rows={4} defaultValue={m.responsibilities ?? ""} /></Field>
        <Field label="Fecha de incorporación al sistema"><Input type="date" name="joinedAt" defaultValue={m.joinedAt ?? today} /></Field>
        {m.id && !m.isAdmin && (
          <div className="flex items-end pb-2">
            <input type="hidden" name="isActive" value="false" />
            <Checkbox name="isActive" value="true" label="Activo" defaultChecked={m.isActive ?? true} />
          </div>
        )}
      </div>
      <p className="text-2xs text-slate-500">Las actividades habituales y la rotación de turnos se configuran en el perfil, después de guardar.</p>
      <div className="border-t border-line pt-4"><Submit>{m.id ? "Guardar cambios" : "Registrar colaborador"}</Submit></div>
    </ActionForm>
  );
}
