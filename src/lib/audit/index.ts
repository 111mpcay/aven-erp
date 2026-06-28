import "server-only";

import type { RlsTx } from "@/lib/db/rls";
import { auditLog } from "@/lib/db/schema";

/**
 * Append-only audit trail (CLAUDE.md: no mutation skips the audit log).
 *
 * writeAudit() runs inside the SAME rls() transaction as the mutation it
 * records, so the two commit or roll back together — a failed mutation never
 * leaves an orphan audit row, and a successful one always has its trail. The
 * audit_log RLS insert policy additionally enforces actor_id = auth.uid() and
 * company membership at the database layer.
 */
export type AuditMeta = {
  actorId: string;
  companyId: string;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

export async function writeAudit(tx: RlsTx, meta: AuditMeta): Promise<void> {
  const hasDiff = meta.before !== undefined || meta.after !== undefined;
  await tx.insert(auditLog).values({
    actorId: meta.actorId,
    companyId: meta.companyId,
    action: meta.action,
    entityType: meta.entityType,
    entityId: meta.entityId ?? null,
    changes: hasDiff
      ? { before: meta.before ?? null, after: meta.after ?? null }
      : null,
    ip: meta.ip ?? null,
  });
}
