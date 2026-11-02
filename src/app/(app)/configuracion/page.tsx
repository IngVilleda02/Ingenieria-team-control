import { Bot, DatabaseBackup, Download, Settings, ShieldCheck } from "lucide-react";
import { createUserAction, restoreAction, saveSettingsAction } from "@/app/(app)/more-actions";
import { ActionForm, Submit } from "@/components/forms";
import { Checkbox, Field, Input, PageHeader, Select } from "@/components/fields";
import { Badge, Card, CardHeader } from "@/components/ui";
import { fmtDateTime, WEEKDAYS } from "@/lib/format";
import { aiStatus } from "@/ai/provider";
import { getDb, schema } from "@/db/client";
import { ctx } from "@/server/context";
import { databaseUrl } from "@/db/url";
import { PERMISSIONS, ROLE_NAMES, type RoleCode } from "@/server/permissions";
import { listMembers } from "@/server/services/members";
import { getSettings } from "@/server/services/settings";
import { listUsers, multiuserEnabled, roleMatrix } from "@/server/services/users";
import { isNull } from "drizzle-orm";

export const metadata = { title: "Configuración" };
const SCOPE: Record<string, string> = { all: "Todo", team: "Su equipo", own: "Lo suyo" };

export default async function SettingsPage() {
  const c = await ctx("settings.manage");
  const s = await getSettings();
  const db = await getDb();
  const defs = await db.select().from(schema.shiftDefinition);
  const cal = await db.select().from(schema.workCalendar).where(isNull(schema.workCalendar.memberId));
  const dia = defs.find((d) => d.kind === "dia");
  const noche = defs.find((d) => d.kind === "noche");
  const [users, members] = await Promise.all([listUsers(c), listMembers(c)]);
  const ai = aiStatus();
  const matrix = roleMatrix();
  const cloud = !!databaseUrl();

  return (
    <>
      <PageHeader icon={Settings} title="Configuración" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader title="Disponibilidad laboral e indicadores" subtitle="Se usan para calcular carga de trabajo, cumplimiento y eficiencia" />
          <ActionForm action={saveSettingsAction} className="space-y-6 p-4">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Turnos</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {[["dia", "Turno de día", dia], ["noche", "Turno de noche", noche]].map(([k, label, d]) => {
                  const def = d as typeof dia;
                  return (
                    <div key={k as string} className="grid grid-cols-3 gap-2 rounded-lg border border-line p-3">
                      <p className="col-span-3 text-[13px] font-medium text-navy-900">{label as string}</p>
                      <Field label="Inicio"><Input type="time" name={`${k}_start`} defaultValue={def?.startTime?.slice(0, 5) ?? "06:00"} required /></Field>
                      <Field label="Horas"><Input type="number" step="0.5" min="1" max="24" name={`${k}_hours`} defaultValue={def ? Number(def.hours) : 8} required /></Field>
                      <Field label="Descanso (min)"><Input type="number" min="0" max="240" name={`${k}_break`} defaultValue={def?.breakMin ?? 60} required /></Field>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {WEEKDAYS.map((w, i) => <Checkbox key={w} name="workdays" value={String(i + 1)} label={w} defaultChecked={cal.find((x) => x.weekday === i + 1)?.isWorkday ?? i < 5} />)}
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ponderación (peso = horas × prioridad × complejidad)</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
                {(["baja", "media", "alta", "critica"] as const).map((p) => <Field key={p} label={`Prioridad ${p}`}><Input type="number" step="0.05" min="0.1" name={`pf_${p}`} defaultValue={s.priority_factor[p]} /></Field>)}
                {(["1", "2", "3", "4", "5"] as const).map((k) => <Field key={k} label={`Complejidad ${k}`}><Input type="number" step="0.05" min="0.1" name={`cf_${k}`} defaultValue={s.complexity_factor[k]} /></Field>)}
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Carga de trabajo y alertas</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Field label="Normal desde (%)" hint="Pendiente ÷ disponible"><Input type="number" name="wt_normal" defaultValue={Math.round(s.workload_thresholds.normal * 100)} /></Field>
                <Field label="Alta desde (%)"><Input type="number" name="wt_alta" defaultValue={Math.round(s.workload_thresholds.alta * 100)} /></Field>
                <Field label="Sobrecarga sobre (%)"><Input type="number" name="wt_sobrecarga" defaultValue={Math.round(s.workload_thresholds.sobrecarga * 100)} /></Field>
                <Field label="Próxima a vencer (días)"><Input type="number" name="due_soon_days" min="0" defaultValue={s.due_soon_days} /></Field>
                <Field label="Muestra mínima" hint="Completadas para calcular"><Input type="number" name="min_sample" min="1" defaultValue={s.min_sample} /></Field>
                <Field label="Tope de eficiencia (%)"><Input type="number" name="efficiency_cap" min="100" defaultValue={s.efficiency_cap} /></Field>
              </div>
            </section>
            <Submit>Guardar configuración</Submit>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader title="Inteligencia artificial" action={<Bot className="h-4 w-4 text-slate-400" />} />
          <div className="space-y-2 px-4 py-4 text-[13px]">
            <p>Estado: {ai.configured ? <Badge tone="ok">Configurada</Badge> : <Badge tone="warn">Sin configurar</Badge>} · proveedor <b>{ai.provider}</b> · modelo <b>{ai.model}</b></p>
            <p className="text-xs text-slate-600">La clave se define como variable de entorno (<code>AI_API_KEY</code>) y nunca se envía al navegador. Para obtener una gratis: entra a aistudio.google.com → Get API key. Sin clave, el generador y el plan del día usan un desglose básico local y el asistente conversacional queda desactivado.</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Respaldo y recuperación" action={<DatabaseBackup className="h-4 w-4 text-slate-400" />} />
          <div className="space-y-3 px-4 py-4 text-[13px]">
            <a href="/api/v1/backup" className="inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-2 font-medium text-white hover:bg-navy-700"><Download className="h-4 w-4" />Descargar respaldo completo (JSON)</a>
            <p className="text-xs text-slate-600">Incluye todas las tablas. {cloud ? "Las evidencias quedan en Vercel Blob." : "Copia además la carpeta data/evidence para conservar los archivos."}</p>
            <ActionForm action={restoreAction} confirm="Se reemplazarán TODOS los datos actuales por los del respaldo. ¿Continuar?" className="space-y-2 rounded-lg border border-red-100 p-3">
              <p className="text-xs font-medium text-bad-700">Restaurar desde respaldo</p>
              <input type="file" name="file" accept="application/json,.json" required className="block text-xs" />
              <Input name="confirm" placeholder="Escribe RESTAURAR" required className="!py-1.5" />
              <Submit variant="danger">Restaurar</Submit>
            </ActionForm>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Usuarios, roles y permisos" subtitle="Preparado para multiusuario: los permisos se validan en el servidor" action={<ShieldCheck className="h-4 w-4 text-slate-400" />} />
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-slate-500">Cuentas</p>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                    <div><p className="text-navy-900">{u.member ?? u.email}</p><p className="text-2xs text-slate-500">{u.email} · último acceso {fmtDateTime(u.lastLoginAt, s.timezone)}</p></div>
                    <Badge tone="navy">{ROLE_NAMES[u.role as RoleCode]}</Badge>
                  </li>
                ))}
              </ul>
              <ActionForm action={createUserAction} className="mt-3 space-y-2 rounded-lg border border-line p-3">
                <p className="text-xs font-medium text-navy-900">Crear cuenta para un colaborador {!multiuserEnabled() && <Badge>Desactivado en esta versión</Badge>}</p>
                <fieldset disabled={!multiuserEnabled()} className="grid gap-2 disabled:opacity-50 sm:grid-cols-2">
                  <Select name="memberId" options={members.map((m) => ({ value: m.id, label: m.fullName }))} className="!mt-0 !py-1.5" />
                  <Select name="role" options={[{ value: "colaborador", label: "Colaborador" }, { value: "supervisor", label: "Supervisor" }]} className="!mt-0 !py-1.5" />
                  <Input name="email" type="email" placeholder="Correo" className="!mt-0 !py-1.5" />
                  <Input name="password" type="password" placeholder="Contraseña inicial" className="!mt-0 !py-1.5" />
                  <Submit variant="soft">Crear cuenta</Submit>
                </fieldset>
                <p className="text-2xs text-slate-500">Se habilita con la variable <code>MULTIUSER_ENABLED=true</code> cuando decidas dar acceso al equipo.</p>
              </ActionForm>
            </div>
            <div className="overflow-x-auto">
              <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-slate-500">Matriz de permisos</p>
              <table className="w-full text-left text-xs">
                <thead className="text-2xs uppercase tracking-wide text-slate-500"><tr className="border-b border-line"><th className="py-1.5 pr-2 font-medium">Permiso</th>{(["admin", "supervisor", "colaborador"] as const).map((r) => <th key={r} className="px-2 py-1.5 font-medium">{ROLE_NAMES[r]}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {Object.entries(PERMISSIONS).map(([code, label]) => (
                    <tr key={code}>
                      <td className="py-1.5 pr-2 text-navy-900">{label}</td>
                      {(["admin", "supervisor", "colaborador"] as const).map((r) => <td key={r} className="px-2 py-1.5 text-slate-600">{matrix[r][code] ? SCOPE[matrix[r][code]] : "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
