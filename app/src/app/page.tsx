import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The bare domain. Supabase falls back to the Site URL (this page)
// when an email's redirect target isn't on its allow-list, and adds
// ?code=… or ?error=…. Hand those to the auth callback so the person
// still lands on the right step instead of a dead end.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  if (sp.code || sp.error || sp.error_description) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
    redirect(`/auth/callback?${qs.toString()}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
