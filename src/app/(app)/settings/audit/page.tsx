import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditLog } from "@/lib/audit";
import { getActiveCompany, requireAuth } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

/** Audit trail viewer — owner/admin only (RLS enforces the same at the DB). */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAuth();
  const { active } = await getActiveCompany();
  if (!active) redirect("/dashboard");
  if (active.role !== "owner" && active.role !== "admin") redirect("/settings");

  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);
  const { rows, total, pageSize } = await listAuditLog(active.id, page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          {active.name} · every mutation, immutable · {total} entr{total === 1 ? "y" : "ies"}
        </p>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="hidden sm:table-cell">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                  No audit entries yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {r.createdAt.toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>{r.actorName || r.actorId?.slice(0, 8) || "system"}</TableCell>
                  <TableCell className="capitalize">{r.action}</TableCell>
                  <TableCell>
                    {r.entityType}
                    {r.entityId && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {r.entityId.slice(0, 8)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {r.ip ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link href="/settings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ← Back to Settings
        </Link>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page > 1 && (
              <Link
                href={`/settings/audit?page=${page - 1}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/settings/audit?page=${page + 1}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Next
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
