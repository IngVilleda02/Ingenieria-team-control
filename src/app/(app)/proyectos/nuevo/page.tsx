import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/fields";
import { ProjectForm } from "@/components/ProjectForm";
import { Card } from "@/components/ui";
import { ctx } from "@/server/context";
import { memberOptions } from "@/server/services/members";

export const metadata = { title: "Nuevo proyecto" };

export default async function NewProject() {
  const c = await ctx("project.manage");
  const members = await memberOptions(c);
  return (
    <>
      <PageHeader icon={FolderKanban} title="Nuevo proyecto" />
      <Card className="max-w-4xl p-5"><ProjectForm members={members} memberIds={members.filter((m) => m.isAdmin).map((m) => m.id)} /></Card>
    </>
  );
}
