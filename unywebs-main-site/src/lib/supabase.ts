import { createClient } from "@supabase/supabase-js";

// Read-only client for the public marketing site.
//
// The anon key is safe in the bundle because RLS on site_solutions and
// site_guides only exposes rows where status = 'published'. Drafts are
// unreachable with it, and draft preview goes through a security-definer
// function that checks the guide's own preview token — so this site
// never needs, and never holds, a service-role key.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. Copy .env.example to .env.local, or add them in the Vercel project settings."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

