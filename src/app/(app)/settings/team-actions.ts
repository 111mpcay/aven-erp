"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasValidPinToken } from "@/lib/auth/pin";
import { getClientIp, requireRole, ROLES, type Role } from "@/lib/auth/rbac";
import { addMember, removeMember, updateMemberRole } from "@/lib/members";

export type ActionResult = {
  ok: boolean;
  error?: string;
  pinRequired?: boolean;
};

const PIN_GATE: ActionResult = {
  ok: false,
  pinRequired: true,
  error: "Role changes need your PIN.",
};

const AddMemberSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(ROLES),
});

export async function addMemberAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(["owner", "admin"]);
  const ip = await getClientIp();
  if (!(await hasValidPinToken(ctx.userId))) return PIN_GATE;

  const parsed = AddMemberSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  // Only an owner may create another owner.
  if (parsed.data.role === "owner" && ctx.role !== "owner") {
    return { ok: false, error: "Only an owner can add an owner." };
  }
  try {
    await addMember({ ...ctx, ip }, parsed.data.email, parsed.data.role);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add member." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateMemberRoleAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(["owner", "admin"]);
  const ip = await getClientIp();
  if (!(await hasValidPinToken(ctx.userId))) return PIN_GATE;

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!userId || !ROLES.includes(role)) return { ok: false, error: "Invalid input." };
  // Only an owner may grant/revoke the owner role.
  if (role === "owner" && ctx.role !== "owner") {
    return { ok: false, error: "Only an owner can grant the owner role." };
  }
  try {
    await updateMemberRole({ ...ctx, ip }, userId, role, ctx.role);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update role." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeMemberAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(["owner", "admin"]);
  const ip = await getClientIp();
  if (!(await hasValidPinToken(ctx.userId))) return PIN_GATE;

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { ok: false, error: "Missing user." };
  if (userId === ctx.userId) {
    return { ok: false, error: "You can't remove yourself. Ask another owner/admin." };
  }
  try {
    await removeMember({ ...ctx, ip }, userId, ctx.role);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to remove member." };
  }
  revalidatePath("/settings");
  return { ok: true };
}
