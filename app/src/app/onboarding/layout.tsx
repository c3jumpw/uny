import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";

// Onboarding is for active workspaces only; unpaid accounts are sent
// to the plan picker first, same as the dashboard.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");
  const access = await getAccess(supabase, user);
  if (!access.allowed) redirect("/plans");
  return <>{children}</>;
}
