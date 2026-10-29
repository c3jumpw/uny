import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";
import { getAccess } from "@/lib/access";
import { DashboardNav } from "@/components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Paywall: accounts that have never paid (or whose trial ended) pick
  // a plan first. Admins, exempt, paying, lapsed, on-trial and invited
  // collaborators go straight in.
  const access = await getAccess(supabase, user);
  if (!access.allowed) redirect("/plans");

  const role = getUserRole(user.email);

  return (
    <>
      <DashboardNav role={role} email={user.email ?? null} />
      <main className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {children}
      </main>
    </>
  );
}
