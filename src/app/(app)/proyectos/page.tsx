import Link from "next/link";
import { Archive, FolderKanban, Plus } from "lucide-react";
import { PriorityBadge, ProjectStatusBadge } from "@/components/badges";
import { FilterBar, LinkButton, MiniSelect, PageHeader } from "@/components/fields";
import { Badge, Card, Empty, Progress } from "@/components/ui";
import { fmtDate, opts, PROJECT_STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/context";
import { listProjects } from "@/server/services/projects";

export const metadata = { title: "Mis proyectos" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await ctx("project.view");
  const archived = sp.archivados === "1";
  const rows = await listProjects(c, { archived, status: sp.estado });
  return (
    <>
      <PageHeader
        icon={FolderKanban}
        title="Mis proyectos"
        subtitle={archived ? "Proyectos archivados" : `${rows.length} proyectos`}
        actions={
          <>
            <LinkButton href={archived ? "/proyectos" : "/proyectos?archivados=1"} variant="soft"><Archive className="h-4 w-4" />{archived ? "Ver activos" : "Archivados"}</LinkButton>
            {c.scope !== "own" && <LinkButton href="/proyectos/nuevo"><Plus className="h-4 w-4" />Nuevo proyecto</LinkButton>}
          </>
        }
      />
      <FilterBar>
        {archived && <input type="hidden" name="archivados" value="1" />}
        <MiniSelect label="Estado" name="estado" value={sp.estado} options={opts(PROJECT_STATUS_LABEL)} />
      </FilterBar>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => (
          <Link key={p.id} href={`/proyectos/${p.id}`} className="block">
            <Card className="h-full p-4 transition hover:border-navy-100 hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-navy-900">{p.name}</h2>
                <ProjectStatusBadge status={p.status} />
              </div>
              {p.category && <p className="mt-0.5 text-2xs text-slate-500">{p.category}</p>}
              {p.description && <p className="mt-2 line-clamp-2 text-xs text-slate-600">{p.description}</p>}
              <div className="mt-3 flex items-center gap-3">
                <Progress value={p.progress} tone={p.late || p.status === "en_riesgo" ? "bad" : "sky"} />
                <span className="tabular w-12 text-right text-xs text-slate-600">{p.progress == null ? "—" : `${p.progress}%`}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-2xs text-slate-500">
                <PriorityBadge priority={p.priority} />
                <span>{p.openCount} abiertas de {p.activityCount}</span>
                {p.overdueCount > 0 && <Badge tone="bad">{p.overdueCount} vencidas</Badge>}
                {p.late && <Badge tone="bad">Atrasado</Badge>}
                <span className="ml-auto">Cierre {fmtDate(p.dueDate)}</span>
              </div>
              {p.ownerName && <p className="mt-2 text-2xs text-slate-500">Responsable: {p.ownerName}</p>}
            </Card>
          </Link>
        ))}
      </div>
      {!rows.length && (
        <Card className="mt-4">
          <Empty icon={FolderKanban} title={archived ? "No hay proyectos archivados" : "Aún no hay proyectos"} text="Crea uno a mano o deja que el Asistente IA lo desglose en fases y actividades." action={<Link href="/proyectos/nuevo" className="text-xs font-medium text-sky-600 hover:underline">Crear proyecto</Link>} />
        </Card>
      )}
    </>
  );
}
