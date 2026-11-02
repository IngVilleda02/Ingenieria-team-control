import { Pencil } from "lucide-react";
import { MemberForm } from "@/components/MemberForm";
import { PageHeader } from "@/components/fields";
import { Card } from "@/components/ui";
import { ctx } from "@/server/context";
import { getMember } from "@/server/services/members";
import { todayIn } from "@/server/services/metrics";
import { getSetting } from "@/server/services/settings";

export const metadata = { title: "Editar ficha" };

export default async function EditMember({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx("member.manage");
  const { member } = await getMember(c, id);
  return (
    <>
      <PageHeader icon={Pencil} title={`Editar: ${member.fullName}`} />
      <Card className="max-w-3xl p-5"><MemberForm m={member} today={todayIn(await getSetting("timezone"))} /></Card>
    </>
  );
}
