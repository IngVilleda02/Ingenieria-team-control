import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { LinkButton, PageHeader } from "@/components/fields";
import { Card, Empty, Insufficient, Progress } from "@/components/ui";
import { ctx } from "@/server/context";
import { teamIndicators } from "@/server/services/indicators";
import { ensureRoutinesGenerated, listMembers } from "@/server/services/members";

export const metadata = { title: "Mi equipo" };

export default async function TeamPage() {
  const c = await ctx("activity.view");
  await ensureRoutinesGenerated(c);
  const [members, ind] = await Promise.all([listMembers(c, { includeInactive: true }), teamIndicators(c)]);
  const byId = new Map(ind.rows.map((r) => [r.id, r]));
  return (
    <>
      <PageHeader icon={Users} title="Mi equipo" subtitle={`${members.filter((m) => m.isActive).length} colaboradores activos`} actions={c.scope === "all" && <LinkButton href="/equipo/nuevo"><Plus className="h-4 w-4" />Registrar colaborador</LinkButton>} />
      {members.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => {
            const r = byId.get(m.id);
            return (
              <Link key={m.id} href={`/equipo/${m.id}`}>
                <Card className={`h-full p-4 transition hover:shadow-sm ${m.isActive ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-navy-900">{m.fullName}</p>
                      <p className="text-2xs text-slate-500">{[m.position, m.area].filter(Boolean).join(" · ") || "Sin puesto"}{m.internalCode ? ` · ${m.internalCode}` : ""}</p>
                    </div>
                    {!r && <span className="text-2xs text-slate-400">Inactivo</span>}
                  </div>
                  {r && (
                    <>
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <Progress value={r.all.completion} tone="ok" />
                        <span className="tabular w-10 shrink-0 text-right">{r.all.completion == null ? "—" : `${r.all.completion}%`}</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                        {[
                          ["Asignadas", r.all.total, "text-navy-900"],
                          ["Completadas", r.all.completed, "text-ok-700"],
                          ["Pendientes", r.all.pending, "text-navy-900"],
                          ["Vencidas", r.all.overdue, r.all.overdue ? "text-bad-700" : "text-navy-900"],
                        ].map(([k, v, cls]) => (
                          <div key={k as string} className="rounded-lg bg-surface/70 px-1 py-1.5">
                            <dd className={`tabular text-base font-semibold ${cls}`}>{v}</dd>
                            <dt className="text-2xs text-slate-500">{k}</dt>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-2 text-2xs text-slate-500">Entregas a tiempo: {r.all.onTime == null ? <Insufficient small /> : `${r.all.onTime}%`}</p>
                    </>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card><Empty icon={Users} title="Aún no registras colaboradores" text="Registra a las tres personas de tu equipo con su perfil laboral." action={<Link href="/equipo/nuevo" className="text-xs font-medium text-sky-600 hover:underline">Registrar colaborador</Link>} /></Card>
      )}
    </>
  );
}
