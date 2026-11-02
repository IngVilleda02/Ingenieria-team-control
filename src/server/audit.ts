import type { Db } from "@/db/client";
import { schema } from "@/db/client";

type Tx = Pick<Db, "insert">;

/** Registro inmutable de cada cambio: quién, qué, antes y después. */
export async function audit(
  tx: Tx,
  entry: { userId: string | null; entityType: string; entityId?: string | null; action: string; before?: unknown; after?: unknown },
) {
  await tx.insert(schema.auditLog).values({
    userId: entry.userId,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    action: entry.action,
    before: (entry.before ?? null) as object | null,
    after: (entry.after ?? null) as object | null,
  });
}
