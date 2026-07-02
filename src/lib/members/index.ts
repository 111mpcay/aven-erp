import "server-only";

import { and, eq, sql as dsql } from "drizzle-orm";

import { writeAudit } from "@/lib/audit";
import { getAdminDb } from "@/lib/db/client";
import { getDb, type RlsTx } from "@/lib/db/rls";
import { companyMembers, profiles } from "@/lib/db/schema";
import type { LedgerContext } from "@/lib/ledger";
import type { Role } from "@/lib/auth/rbac";

/**
 * lib/members — team management for the active company (Phase 5 RBAC matrix).
 *
 * Reads/writes run under RLS (the 0009 admin policies + is_company_admin());
 * requireRole(["owner","admin"]) is the app-layer gate, and role changes are
 * PIN-gated in the Server Actions. Emails live in auth.users, which RLS clients
 * can't read — they're resolved server-side via the admin client and never
 * exposed beyond the admin-only Team UI.
 */

export type Member = {
  userId: string;
  role: Role;
  fullName: string | null;
  email: string | null;
  joinedAt: Date;
};

export async function listMembers(companyId: string): Promise<Member[]> {
  const db = await getDb();
  const rows = await db.rls((tx) =>
    tx
      .select({
        userId: companyMembers.userId,
        role: companyMembers.role,
        fullName: profiles.fullName,
        joinedAt: companyMembers.createdAt,
      })
      .from(companyMembers)
      .leftJoin(profiles, eq(profiles.id, companyMembers.userId))
      .where(eq(companyMembers.companyId, companyId))
      .orderBy(companyMembers.createdAt),
  );
  if (rows.length === 0) return [];

  // Emails from auth.users — trusted server context only (admin bypasses RLS).
  const ids = rows.map((r) => r.userId);
  const emailRows = (await getAdminDb().execute(
    dsql`select id, email from auth.users where id = any(${ids}::uuid[])`,
  )) as unknown as { id: string; email: string | null }[];
  const emailById = new Map(emailRows.map((r) => [r.id, r.email]));

  return rows.map((r) => ({ ...r, email: emailById.get(r.userId) ?? null }));
}

/**
 * Count OTHER owners of a company inside the given transaction, locking the
 * matching rows (FOR UPDATE) so a concurrent demote/remove can't drop the last
 * owner via a stale read.
 */
async function countOtherOwnersLocked(
  tx: RlsTx,
  companyId: string,
  excludeUserId: string,
): Promise<number> {
  const [row] = (await tx.execute(dsql`
    select count(*)::int as n from company_members
    where company_id = ${companyId} and role = 'owner' and user_id <> ${excludeUserId}
    for update
  `)) as unknown as { n: number }[];
  return row?.n ?? 0;
}

/** Add an EXISTING auth user (by email) to the active company. */
export async function addMember(ctx: LedgerContext, email: string, role: Role) {
  const found = (await getAdminDb().execute(
    dsql`select id from auth.users where lower(email) = ${email.toLowerCase().trim()}`,
  )) as unknown as { id: string }[];
  if (found.length === 0) {
    throw new Error("No account with that email. Ask them to sign up first.");
  }
  const userId = found[0].id;

  // Profile row may not exist yet (FK target); create via trusted admin path.
  await getAdminDb().insert(profiles).values({ id: userId }).onConflictDoNothing();

  const db = await getDb();
  return db.rls(async (tx) => {
    const [row] = await tx
      .insert(companyMembers)
      .values({ companyId: ctx.companyId, userId, role })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new Error("That person is already a member of this company.");
    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "create",
      entityType: "member",
      entityId: userId,
      after: { userId, role },
      ip: ctx.ip,
    });
    return row;
  });
}

export async function updateMemberRole(
  ctx: LedgerContext,
  userId: string,
  role: Role,
  actorRole: Role,
) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(companyMembers)
      .where(
        and(eq(companyMembers.companyId, ctx.companyId), eq(companyMembers.userId, userId)),
      );
    if (!before) throw new Error("Member not found.");
    // Only an owner may change an owner's role (grant or revoke).
    if ((before.role === "owner" || role === "owner") && actorRole !== "owner") {
      throw new Error("Only an owner can change an owner's role.");
    }
    if (before.role === "owner" && role !== "owner") {
      const others = await countOtherOwnersLocked(tx, ctx.companyId, userId);
      if (others === 0) throw new Error("A company must keep at least one owner.");
    }
    const [row] = await tx
      .update(companyMembers)
      .set({ role })
      .where(
        and(eq(companyMembers.companyId, ctx.companyId), eq(companyMembers.userId, userId)),
      )
      .returning();
    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "update",
      entityType: "member",
      entityId: userId,
      before: { role: before.role },
      after: { role },
      ip: ctx.ip,
    });
    return row;
  });
}

export async function removeMember(ctx: LedgerContext, userId: string, actorRole: Role) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(companyMembers)
      .where(
        and(eq(companyMembers.companyId, ctx.companyId), eq(companyMembers.userId, userId)),
      );
    if (!before) throw new Error("Member not found.");
    // Only an owner may remove an owner.
    if (before.role === "owner" && actorRole !== "owner") {
      throw new Error("Only an owner can remove an owner.");
    }
    if (before.role === "owner") {
      const others = await countOtherOwnersLocked(tx, ctx.companyId, userId);
      if (others === 0) throw new Error("A company must keep at least one owner.");
    }
    await tx
      .delete(companyMembers)
      .where(
        and(eq(companyMembers.companyId, ctx.companyId), eq(companyMembers.userId, userId)),
      );
    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "delete",
      entityType: "member",
      entityId: userId,
      before: { role: before.role },
      ip: ctx.ip,
    });
    return before;
  });
}
