import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, canAccessAdmin } from "@/lib/admin";
import { DashboardNav } from "@/components/DashboardNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = getUserRole(user.email);
  if (!canAccessAdmin(role)) redirect("/dashboard");

  return (
    <>
      <DashboardNav role={role} email={user.email ?? null} />
      <main className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {children}
      </main>
    </>
  );
}
