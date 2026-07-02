"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getClientIp, requireRole, WRITE_ROLES } from "@/lib/auth/rbac";
import { updateFulfillment, FULFILLMENT_STATUSES } from "@/lib/logistics";
import { nonNegativeMoney } from "@/lib/validation/money";

export type ActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const FulfillmentSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(FULFILLMENT_STATUSES),
  courier: z.string().trim().max(120).optional(),
  trackingNo: z.string().trim().max(120).optional(),
  cost: nonNegativeMoney.default("0"),
});

export async function updateFulfillmentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(WRITE_ROLES);
  const ip = await getClientIp();

  const parsed = FulfillmentSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
    status: String(formData.get("status") ?? ""),
    courier: (formData.get("courier") as string) || undefined,
    trackingNo: (formData.get("trackingNo") as string) || undefined,
    cost: String(formData.get("cost") ?? "0") || "0",
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fe[k]) fe[k] = i.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  try {
    await updateFulfillment({ ...ctx, ip }, parsed.data.orderId, {
      status: parsed.data.status,
      courier: parsed.data.courier ?? null,
      trackingNo: parsed.data.trackingNo ?? null,
      cost: parsed.data.cost,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update." };
  }
  revalidatePath("/logistics");
  return { ok: true };
}
