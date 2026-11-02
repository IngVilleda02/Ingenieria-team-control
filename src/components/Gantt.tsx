import Link from "next/link";
import clsx from "clsx";

type Row = { id: string; title: string; start: string | null; end: string | null; status: string; overdue: boolean; group?: string | null; who?: string };

const MS = 864e5;
const t = (d: string) => Date.parse(`${d}T12:00:00Z`);
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Cronograma Gantt: barras de inicio a límite, con la línea de hoy. Sin fechas, la fila lo indica. */
export function Gantt({ rows, today, projectStart, projectEnd }: { rows: Row[]; today: string; projectStart?: string | null; projectEnd?: string | null }) {
  const dated = rows.filter((r) => r.start || r.end);
  const pts = [...dated.flatMap((r) => [r.start ?? r.end!, r.end ?? r.start!]), today, projectStart, projectEnd].filter(Boolean) as string[];
  if (!dated.length) return <p className="px-4 py-6 text-center text-xs text-slate-500">Agrega fechas de inicio o límite a las actividades para ver el cronograma.</p>;
  const lo = Math.min(...pts.map(t)) - 2 * MS;
  const hi = Math.max(...pts.map(t)) + 3 * MS;
  const x = (d: string) => ((t(d) - lo) / (hi - lo)) * 100;
  const ticks: string[] = [];
  const spanDays = (hi - lo) / MS;
  if (spanDays <= 120) {
    const d = new Date(lo);
    d.setUTCHours(12, 0, 0, 0);
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); // lunes
    const step = spanDays > 70 ? 14 : 7;
    for (; d.getTime() <= hi; d.setUTCDate(d.getUTCDate() + step)) ticks.push(d.toISOString().slice(0, 10));
  } else {
    const d = new Date(lo);
    d.setUTCDate(1);
    for (; d.getTime() <= hi; d.setUTCMonth(d.getUTCMonth() + 1)) if (d.getTime() >= lo) ticks.push(d.toISOString().slice(0, 10));
  }
  const tickLabel = (d: string) => (spanDays <= 120 ? `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}` : `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`);
  const color = (r: Row) =>
    r.status === "completada" ? "bg-ok-600" : r.overdue ? "bg-bad-600" : r.status === "bloqueada" ? "bg-bad-600/60" : r.status === "en_proceso" || r.status === "en_revision" ? "bg-sky-500" : "bg-slate-400";
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="relative ml-52 h-6 border-b border-line text-2xs text-slate-500">
          {ticks.map((d) => (
            <span key={d} className="absolute top-1 -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(d)}%` }}>{tickLabel(d)}</span>
          ))}
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-52 right-0">
            {ticks.map((d) => <div key={d} className="absolute inset-y-0 w-px bg-line/70" style={{ left: `${x(d)}%` }} />)}
            <div className="absolute inset-y-0 w-px bg-sky-500/70" style={{ left: `${x(today)}%` }} title="Hoy" />
            {projectEnd && <div className="absolute inset-y-0 w-px border-l border-dashed border-bad-600/60" style={{ left: `${x(projectEnd)}%` }} title="Fecha estimada del proyecto" />}
          </div>
          {rows.map((r, i) => {
            const s = r.start ?? r.end;
            const e = r.end ?? r.start;
            const showGroup = r.group !== undefined && r.group !== rows[i - 1]?.group;
            return (
              <div key={r.id}>
                {showGroup && <div className="ml-0 border-b border-line bg-surface/60 px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-slate-500">{r.group ?? "Sin fase"}</div>}
                <div className="flex h-8 items-center border-b border-line/60">
                  <Link href={`/actividades/${r.id}`} className="w-52 shrink-0 truncate px-2 text-xs text-navy-900 hover:underline" title={r.title}>{r.title}</Link>
                  <div className="relative h-full flex-1">
                    {s && e ? (
                      <div
                        className={clsx("absolute top-2 h-4 rounded", color(r))}
                        style={{ left: `${x(s)}%`, width: `max(6px, ${x(e) - x(s) + (100 / ((hi - lo) / MS))}%)` }}
                        title={`${r.title}: ${s} → ${e}${r.who ? ` · ${r.who}` : ""}`}
                      />
                    ) : (
                      <span className="absolute left-2 top-2 text-2xs text-slate-400">Sin fechas</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 pl-52 text-2xs text-slate-500">
          <span className="flex items-center gap-1"><i className="h-2 w-3 rounded bg-slate-400" />Pendiente</span>
          <span className="flex items-center gap-1"><i className="h-2 w-3 rounded bg-sky-500" />En curso</span>
          <span className="flex items-center gap-1"><i className="h-2 w-3 rounded bg-ok-600" />Completada</span>
          <span className="flex items-center gap-1"><i className="h-2 w-3 rounded bg-bad-600" />Vencida</span>
          <span className="flex items-center gap-1"><i className="h-3 w-px bg-sky-500" />Hoy</span>
        </div>
      </div>
    </div>
  );
}
