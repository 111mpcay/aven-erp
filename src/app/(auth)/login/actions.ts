"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

// One Zod schema per form (CLAUDE.md convention): validates input + infers types.
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  // Generic message on validation failure (avoids account enumeration).
  if (!parsed.success) redirect("/login?error=1");

  // Wrap only the network call; keep redirect() OUTSIDE try/catch so its
  // NEXT_REDIRECT control-flow throw is never swallowed.
  let ok = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    ok = !error;
  } catch {
    ok = false;
  }

  if (!ok) redirect("/login?error=1");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
