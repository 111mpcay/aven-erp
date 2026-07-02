import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { getDb, type RlsTx } from "@/lib/db/rls";
import { auditLog, profiles } from "@/lib/db/schema";

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

export type AuditRow = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: Date;
};

/**
 * Paginated audit trail for the active company. RLS restricts SELECT on
 * audit_log to owner/admin; the caller must also requireRole(["owner","admin"]).
 */
export async function listAuditLog(
  companyId: string,
  page = 1,
  pageSize = 50,
): Promise<{ rows: AuditRow[]; total: number; page: number; pageSize: number }> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(200, Math.max(1, pageSize));
  const db = await getDb();
  return db.rls(async (tx) => {
    const rows = await tx
      .select({
        id: auditLog.id,
        actorId: auditLog.actorId,
        actorName: profiles.fullName,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        ip: auditLog.ip,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(profiles, eq(profiles.id, auditLog.actorId))
      .where(eq(auditLog.companyId, companyId))
      .orderBy(desc(auditLog.createdAt))
      .limit(safeSize)
      .offset((safePage - 1) * safeSize);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(eq(auditLog.companyId, companyId));

    return { rows, total, page: safePage, pageSize: safeSize };
  });
}

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
