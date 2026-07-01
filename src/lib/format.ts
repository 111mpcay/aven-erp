/** Display formatting shared by server and client components. */

export function formatMoney(amount: string | number, currency = "PHP"): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/**
 * Business dates are Manila-local (PHP ERP): the server may run in UTC, so
 * "today" must be computed timezone-explicitly or the default dashboard range
 * silently excludes the current business day between 00:00–08:00 Manila.
 * en-CA locale formats as YYYY-MM-DD.
 */
export function manilaDateDaysAgo(days = 0): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - days * 86_400_000));
}

/** Semantic ISO-date check (rejects 2026-02-31 etc., not just bad shapes). */
export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Format a YYYY-MM-DD date string without timezone drift. */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
