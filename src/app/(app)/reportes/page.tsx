import { FileBarChart, FileSpreadsheet, FileText } from "lucide-react";
import { Field, PageHeader } from "@/components/fields";
import { Card, CardHeader } from "@/components/ui";
import { ctx } from "@/server/context";
import { listMembers } from "@/server/services/members";
import { projectOptions } from "@/server/services/projects";

export const metadata = { title: "Reportes" };

const sel = "mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px]";

function ReportForm({ tipo, title, desc, targets, targetLabel }: { tipo: string; title: string; desc: string; targets?: { value: string; label: string }[]; targetLabel?: string }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={desc} />
      <form method="get" action="/api/v1/reports" target="_blank" className="space-y-3 p-4">
        <input type="hidden" name="tipo" value={tipo} />
        {targets && (
          <Field label={targetLabel ?? ""}>
            <select name="objetivo" required className={sel}>{targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </Field>
        )}
        <Field label="Periodo">
          <select name="periodo" defaultValue="semanal" className={sel}>
            <option value="diario">Diario (hoy)</option><option value="semanal">Semanal (últimos 7 días)</option><option value="mensual">Mensual (últimos 30 días)</option><option value="personalizado">Personalizado</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Desde (personalizado)"><input type="date" name="desde" className={sel} /></Field>
          <Field label="Hasta (personalizado)"><input type="date" name="hasta" className={sel} /></Field>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button name="formato" value="pdf" className="inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-2 text-[13px] font-medium text-white hover:bg-navy-700"><FileText className="h-4 w-4" />PDF</button>
          <button name="formato" value="xlsx" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-medium text-navy-800 ring-1 ring-inset ring-line hover:bg-navy-50"><FileSpreadsheet className="h-4 w-4" />Excel</button>
        </div>
      </form>
    </Card>
  );
}

export default async function ReportsPage() {
  const c = await ctx("metrics.view");
  const [members, projects] = await Promise.all([listMembers(c, { includeAdmin: true }), projectOptions(c)]);
  return (
    <>
      <PageHeader icon={FileBarChart} title="Reportes" subtitle="Se generan con los datos registrados al momento de descargarlos" />
      <div className="grid gap-4 lg:grid-cols-3">
        <ReportForm tipo="general" title="Reporte general" desc="Proyectos activos, avance, cumplimiento por colaborador, extraordinarias, eficiencia, principales retrasos y recomendaciones." />
        <ReportForm tipo="individual" title="Reporte individual" desc="Habituales y extraordinarias por separado, cumplimiento, tiempo promedio y evidencias." targetLabel="Colaborador" targets={members.map((m) => ({ value: m.id, label: m.isAdmin ? `${m.fullName} (yo)` : m.fullName }))} />
        <ReportForm tipo="proyecto" title="Reporte por proyecto" desc="Avance contra plan, fecha proyectada y estado de cada actividad." targetLabel="Proyecto" targets={projects.map((p) => ({ value: p.id, label: p.name }))} />
      </div>
    </>
  );
}
