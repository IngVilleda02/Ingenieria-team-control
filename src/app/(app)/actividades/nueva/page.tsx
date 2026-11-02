import { Sun } from "lucide-react";
import { createActivityAction } from "@/app/(app)/actions";
import { ActivityForm } from "@/components/ActivityForm";
import { PageHeader } from "@/components/fields";
import { Card } from "@/components/ui";
import { ctx } from "@/server/context";
import { formOptions } from "@/server/options";

export const metadata = { title: "Nueva actividad personal" };

export default async function NewPersonalActivity({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await ctx("activity.manage");
  const o = await formOptions(c);
  return (
    <>
      <PageHeader icon={Sun} title="Nueva actividad personal" subtitle="Trabajo que realizas tú directamente." />
      <Card className="max-w-4xl p-5">
        <ActivityForm action={createActivityAction} mode="personal" {...o} defaults={{ projectId: sp.proyecto, parentId: sp.padre, dueDate: sp.fecha, startDate: sp.fecha }} returnTo={sp.volver} />
      </Card>
    </>
  );
}
