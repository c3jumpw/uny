import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, canAccessAdmin } from "@/lib/admin";
import { DashboardNav } from "@/components/DashboardNav";
import { AdminTabs } from "@/components/AdminTabs";
import { WhatsNewModal } from "@/components/changelog/WhatsNewModal";
import { whatsNewFor } from "@/lib/changelog";

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

  const news = whatsNewFor(user, role);

  return (
    <>
      <DashboardNav role={role} email={user.email ?? null} />
      <main className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <AdminTabs role={role} />
        {children}
      </main>
      <WhatsNewModal entries={news.entries} total={news.total} latestId={news.latestId} seeAllHref="/admin/changelog" />
    </>
  );
}
