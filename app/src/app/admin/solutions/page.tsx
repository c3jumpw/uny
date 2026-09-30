import { serviceClient, type SolutionRow } from "@/lib/siteContent";
import { ContentTabs } from "@/components/ContentTabs";
import { SolutionsAdmin } from "@/components/SolutionsAdmin";

// Marketing-site solutions. The admin layout already gated access, so
// this page only has to load the rows — including drafts and archived
// ones, which the public anon key cannot see.

export const dynamic = "force-dynamic";

export default async function SolutionsAdminPage() {
  const admin = serviceClient();

  if (!admin) {
    return (
      <>
        <ContentTabs />
        <div className="card" style={{ padding: 24 }}>
          <h1 style={{ marginTop: 0, fontSize: "1.3rem" }}>Solutions</h1>
          <p style={{ color: "var(--paper-dim)", margin: 0 }}>
            <code>SUPABASE_SERVICE_ROLE_KEY</code> is not set on this
            deployment, so content cannot be loaded or saved. Add it in the
            Vercel project settings and redeploy.
          </p>
        </div>
      </>
    );
  }

  const { data } = await admin
    .from("site_solutions")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <>
      <ContentTabs />
      <SolutionsAdmin initial={(data ?? []) as SolutionRow[]} />
    </>
  );
}
