import { Pencil } from "lucide-react";
import { updateActivityAction } from "@/app/(app)/actions";
import { ActivityForm } from "@/components/ActivityForm";
import { PageHeader } from "@/components/fields";
import { Card } from "@/components/ui";
import { ctx } from "@/server/context";
import { formOptions } from "@/server/options";
import { getActivity } from "@/server/services/activities";

export const metadata = { title: "Editar actividad" };

export default async function EditActivity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx("activity.manage");
  const [d, o] = await Promise.all([getActivity(c, id), formOptions(c)]);
  const a = d.activity;
  return (
    <>
      <PageHeader icon={Pencil} title="Editar actividad" subtitle="Cambiar fechas reprograma la actividad y queda registrado en el historial." />
      <Card className="max-w-4xl p-5">
        <ActivityForm
          action={updateActivityAction}
          mode="editar"
          {...o}
          defaults={{ ...a, memberIds: d.assignments.map((x) => x.a.memberId), dependsOn: d.deps.map((x) => x.id) }}
        />
      </Card>
    </>
  );
}
