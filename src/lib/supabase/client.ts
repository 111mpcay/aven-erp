import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client. Uses the public URL + publishable key (safe with RLS on). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
