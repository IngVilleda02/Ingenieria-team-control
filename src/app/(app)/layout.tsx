import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getSession } from "@/server/auth";
import { ctx } from "@/server/context";
import { ROLE_NAMES } from "@/server/permissions";
import { syncNotificationsThrottled, unreadCount } from "@/server/services/reminders";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const c = await ctx("dashboard.view");
  await syncNotificationsThrottled(c.db).catch((e) => console.error("syncNotifications", e));
  const unread = await unreadCount(c);
  return <Shell user={{ name: session.name, role: ROLE_NAMES[session.role] }} unread={unread}>{children}</Shell>;
}
