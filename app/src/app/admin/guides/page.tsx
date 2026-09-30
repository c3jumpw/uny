import Link from "next/link";
import { serviceClient, type GuideRow } from "@/lib/siteContent";
import { ContentTabs } from "@/components/ContentTabs";
import { NewGuideButton } from "@/components/NewGuideButton";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "Live", cls: "pill pill-good" },
  draft: { label: "Draft", cls: "pill pill-warn" },
  archived: { label: "Archived", cls: "pill" },
};

export default async function GuidesAdminPage() {
  const admin = serviceClient();

  if (!admin) {
    return (
      <>
        <ContentTabs />
        <div className="card" style={{ padding: 24 }}>
          <h1 style={{ marginTop: 0, fontSize: "1.3rem" }}>Guides</h1>
          <p style={{ color: "var(--paper-dim)", margin: 0 }}>
            <code>SUPABASE_SERVICE_ROLE_KEY</code> is not set on this
            deployment, so content cannot be loaded or saved.
          </p>
        </div>
      </>
    );
  }

  const { data } = await admin
    .from("site_guides")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  const guides = (data ?? []) as GuideRow[];
  const siteBase = (process.env.MARKETING_SITE_URL || "").replace(/\/$/, "");

  return (
    <>
      <ContentTabs />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem", fontWeight: 600 }}>
            Guides
          </h1>
          <p style={{ margin: 0, color: "var(--paper-dim)", fontSize: "0.9rem" }}>
            Articles on unywebs.com/guides. Drafts are invisible to the public
            until you publish.
          </p>
        </div>
        <NewGuideButton />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: "1%" }}>Status</th>
              <th>Guide</th>
              <th>Last edited</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {guides.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--paper-dim)" }}>
                  No guides yet. Write the first one.
                </td>
              </tr>
            ) : (
              guides.map((g) => {
                const st = STATUS[g.status] ?? STATUS.draft;
                const liveUrl = siteBase ? `${siteBase}/guides/${g.slug}` : null;
                return (
                  <tr key={g.id}>
                    <td>
                      <span className={st.cls}>{st.label}</span>
                    </td>
                    <td>
                      <Link
                        href={`/admin/guides/${g.id}`}
                        style={{ fontWeight: 500, color: "var(--paper)" }}
                      >
                        {g.title}
                      </Link>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        /guides/{g.slug}
                      </div>
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--paper-dim)" }}>
                      {new Date(g.updated_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        <Link
                          href={`/admin/guides/${g.id}`}
                          className="btn btn-ghost"
                          style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                        >
                          Edit
                        </Link>
                        {g.status === "published" && liveUrl && (
                          <a
                            href={liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost"
                            style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                          >
                            View live
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
