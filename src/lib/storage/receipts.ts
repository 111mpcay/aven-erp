import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Receipt storage — private Supabase Storage bucket `receipts`.
 *
 * Uploads/reads go through the SESSION-scoped server client, so Storage RLS
 * (keyed to the {company_id}/… path prefix) enforces tenant isolation exactly
 * like table RLS. We persist only the object PATH (`expenses.receipt_path`),
 * never a public URL — viewing always mints a short-lived signed URL. See
 * docs/PHASE_1_SETUP.md for the bucket + policy SQL.
 */
export const RECEIPTS_BUCKET = "receipts";
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext =
    dot >= 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base =
    (dot >= 0 ? name.slice(0, dot) : name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "receipt";
  return ext ? `${base}.${ext}` : base;
}

/** Validate a candidate receipt; throws a user-facing message if unacceptable. */
export function assertValidReceipt(file: File): void {
  if (file.size === 0) throw new Error("Receipt file is empty.");
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error("Receipt is too large (max 10 MB).");
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type as never)) {
    throw new Error("Receipt must be a JPG, PNG, WEBP, HEIC, or PDF.");
  }
}

/**
 * Upload a receipt under the company's path prefix and return the stored path.
 * Path shape: {companyId}/{uuid}/{safe-filename} — the leading companyId is what
 * the Storage RLS policy checks.
 */
export async function uploadReceipt(
  companyId: string,
  file: File,
): Promise<string> {
  assertValidReceipt(file);
  const supabase = await createClient();
  const path = `${companyId}/${crypto.randomUUID()}/${safeName(file.name)}`;
  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(`Receipt upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for viewing a stored receipt, or null if unavailable. */
export async function getReceiptSignedUrl(
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Remove a receipt object (best-effort; used when an expense is deleted). */
export async function deleteReceipt(path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
}
