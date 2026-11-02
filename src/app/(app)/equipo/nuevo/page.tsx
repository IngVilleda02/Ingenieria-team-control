import { UserPlus } from "lucide-react";
import { MemberForm } from "@/components/MemberForm";
import { PageHeader } from "@/components/fields";
import { Card } from "@/components/ui";
import { ctx } from "@/server/context";
import { todayIn } from "@/server/services/metrics";
import { getSetting } from "@/server/services/settings";

export const metadata = { title: "Registrar colaborador" };

export default async function NewMember() {
  await ctx("member.manage");
  return (
    <>
      <PageHeader icon={UserPlus} title="Registrar colaborador" subtitle="Ficha laboral. En esta versión los colaboradores no inician sesión; tú registras su información." />
      <Card className="max-w-3xl p-5"><MemberForm today={todayIn(await getSetting("timezone"))} /></Card>
    </>
  );
}
