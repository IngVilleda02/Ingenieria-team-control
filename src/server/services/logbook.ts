/** Bitácora: línea cronológica construida desde audit_log (nada se escribe a mano). */
import { and, desc, eq, gte, inArray, lte, or, type SQL } from "drizzle-orm";
import { schema } from "@/db/client";
import { visibleMemberIds, type Ctx } from "../context";

export type TimelineItem = {
  id: string; at: Date; action: string; entityType: string; entityId: string | null; title: string | null; user: string | null; detail: Record<string, unknown> | null; before: Record<string, unknown> | null;
};

export async function timeline(c: Ctx, f: { projectId?: string | null; memberId?: string | null; from?: string | null; to?: string | null; limit?: number } = {}): Promise<TimelineItem[]> {
  const L = schema.auditLog;
  const conds: SQL[] = [];
  let activityIds: string[] = [];
  let assignmentIds: string[] = [];
  const visible = await visibleMemberIds(c);
  const memberFilter = f.memberId ? [f.memberId] : visible;

  if (f.projectId || memberFilter) {
    const acts = await c.db
      .select({ id: schema.activity.id, asg: schema.activityAssignment.id, memberId: schema.activityAssignment.memberId })
      .from(schema.activity)
      .innerJoin(schema.activityAssignment, eq(schema.activityAssignment.activityId, schema.activity.id))
      .where(and(f.projectId ? eq(schema.activity.projectId, f.projectId) : undefined, memberFilter ? inArray(schema.activityAssignment.memberId, memberFilter.length ? memberFilter : ["00000000-0000-0000-0000-000000000000"]) : undefined));
    activityIds = [...new Set(acts.map((a) => a.id))];
    assignmentIds = acts.map((a) => a.asg);
    const ors: SQL[] = [];
    if (activityIds.length) ors.push(and(eq(L.entityType, "activity"), inArray(L.entityId, activityIds))!);
    if (assignmentIds.length) ors.push(and(eq(L.entityType, "assignment"), inArray(L.entityId, assignmentIds))!);
    if (f.projectId) ors.push(and(eq(L.entityType, "project"), eq(L.entityId, f.projectId))!);
    if (memberFilter?.length) ors.push(and(eq(L.entityType, "member"), inArray(L.entityId, memberFilter))!);
    if (!ors.length) return [];
    conds.push(or(...ors)!);
  }
  if (f.from) conds.push(gte(L.at, new Date(`${f.from}T00:00:00-06:00`)));
  if (f.to) conds.push(lte(L.at, new Date(`${f.to}T23:59:59-06:00`)));

  const rows = await c.db
    .select({ l: L, user: schema.member.fullName })
    .from(L)
    .leftJoin(schema.appUser, eq(schema.appUser.id, L.userId))
    .leftJoin(schema.member, eq(schema.member.id, schema.appUser.memberId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(L.at))
    .limit(f.limit ?? 200);

  // Títulos legibles
  const actIds = new Set<string>();
  const asgIds = new Set<string>();
  for (const r of rows) {
    if (r.l.entityType === "activity" && r.l.entityId) actIds.add(r.l.entityId);
    if (r.l.entityType === "assignment" && r.l.entityId) asgIds.add(r.l.entityId);
  }
  const asgMap = asgIds.size
    ? new Map(
        (await c.db
          .select({ id: schema.activityAssignment.id, activityId: schema.activityAssignment.activityId, title: schema.activity.title, who: schema.member.fullName })
          .from(schema.activityAssignment)
          .innerJoin(schema.activity, eq(schema.activity.id, schema.activityAssignment.activityId))
          .innerJoin(schema.member, eq(schema.member.id, schema.activityAssignment.memberId))
          .where(inArray(schema.activityAssignment.id, [...asgIds]))).map((x) => [x.id, x]),
      )
    : new Map();
  const titleMap = actIds.size
    ? new Map((await c.db.select({ id: schema.activity.id, title: schema.activity.title }).from(schema.activity).where(inArray(schema.activity.id, [...actIds]))).map((x) => [x.id, x.title]))
    : new Map<string, string>();
  const projMap = new Map((await c.db.select({ id: schema.project.id, name: schema.project.name }).from(schema.project)).map((x) => [x.id, x.name]));
  const memMap = new Map((await c.db.select({ id: schema.member.id, name: schema.member.fullName }).from(schema.member)).map((x) => [x.id, x.name]));

  return rows.map(({ l, user }) => {
    let title: string | null = null;
    let entityId = l.entityId;
    if (l.entityType === "activity") title = titleMap.get(l.entityId ?? "") ?? null;
    if (l.entityType === "assignment") {
      const a = asgMap.get(l.entityId ?? "");
      title = a ? `${a.title} · ${a.who}` : null;
      entityId = a?.activityId ?? null;
    }
    if (l.entityType === "project") title = projMap.get(l.entityId ?? "") ?? null;
    if (l.entityType === "member") title = memMap.get(l.entityId ?? "") ?? null;
    return { id: l.id, at: l.at, action: l.action, entityType: l.entityType, entityId, title, user, detail: (l.after as Record<string, unknown>) ?? null, before: (l.before as Record<string, unknown>) ?? null };
  });
}
