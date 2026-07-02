"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/rbac";
import { setActionPin, verifyActionPin } from "@/lib/auth/pin";

export type PinActionResult = { ok: boolean; error?: string };

/** Verify the action PIN and mint the short-lived token cookie. */
export async function verifyPinAction(
  _prev: PinActionResult,
  formData: FormData,
): Promise<PinActionResult> {
  const user = await requireAuth();
  const pin = String(formData.get("pin") ?? "");
  const result = await verifyActionPin(user.id, pin);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/** Set or change the current user's action PIN (requires the old PIN if set). */
export async function setPinAction(
  _prev: PinActionResult,
  formData: FormData,
): Promise<PinActionResult> {
  const user = await requireAuth();
  const pin = String(formData.get("pin") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (pin !== confirm) return { ok: false, error: "PINs don't match." };

  const { hasPinConfigured } = await import("@/lib/auth/pin");
  if (await hasPinConfigured(user.id)) {
    const current = String(formData.get("currentPin") ?? "");
    const check = await verifyActionPin(user.id, current);
    if (!check.ok) return { ok: false, error: `Current PIN check failed: ${check.error}` };
  }

  const error = await setActionPin(user.id, pin);
  if (error) return { ok: false, error };
  // Flip SecuritySection's hasPin so the "Current PIN" field appears next time.
  revalidatePath("/settings");
  return { ok: true };
}
