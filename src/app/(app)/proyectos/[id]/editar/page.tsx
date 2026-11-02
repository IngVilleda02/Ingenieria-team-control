import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/fields";
import { ProjectForm } from "@/components/ProjectForm";
import { Card } from "@/components/ui";
import { ctx } from "@/server/context";
import { memberOptions } from "@/server/services/members";
import { getProject } from "@/server/services/projects";

export const metadata = { title: "Editar proyecto" };

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx("project.manage");
  const [d, members] = await Promise.all([getProject(c, id), memberOptions(c)]);
  return (
    <>
      <PageHeader icon={Pencil} title={`Editar: ${d.project.name}`} />
      <Card className="max-w-4xl p-5"><ProjectForm p={d.project} members={members} memberIds={d.members.map((m) => m.id)} /></Card>
    </>
  );
}
