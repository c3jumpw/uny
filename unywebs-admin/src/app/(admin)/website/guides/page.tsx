import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { siteBase } from "@/lib/admin";
import type { GuideRow } from "@/lib/shared";
import { NewGuideButton } from "@/components/NewGuideButton";

export const metadata: Metadata = { title: "Guides" };

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "Live", cls: "pill pill-good" },
  draft: { label: "Draft", cls: "pill pill-warn" },
  archived: { label: "Archived", cls: "pill" },
};

export default async function GuidesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_guides")
    .select("id, slug, title, status, updated_at")
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  const guides = (data ?? []) as Pick<GuideRow, "id" | "slug" | "title" | "status" | "updated_at">[];
  const site = siteBase();

  return (
    <>
      <p className="crumb">
        <Link href="/">Admin</Link> / Website / Guides
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div className="page-head" style={{ margin: 0 }}>
          <h1>Guides</h1>
          <p>Articles on unywebs.com/guides. Drafts stay private until you publish.</p>
        </div>
        <NewGuideButton />
      </div>

      <div className="card tbl-scroll" style={{ padding: 0 }}>
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
            {error ? (
              <tr>
                <td colSpan={4} style={{ color: "var(--danger)" }}>
                  The guides could not be loaded: {error.message}
                </td>
              </tr>
            ) : guides.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--paper-dim)" }}>
                  No guides yet. Write the first one.
                </td>
              </tr>
            ) : (
              guides.map((g) => {
                const st = STATUS[g.status] ?? STATUS.draft;
                return (
                  <tr key={g.id}>
                    <td>
                      <span className={st.cls}>{st.label}</span>
                    </td>
                    <td>
                      <Link href={`/website/guides/${g.id}`} style={{ fontWeight: 600 }}>
                        {g.title}
                      </Link>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>/guides/{g.slug}</div>
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--paper-dim)", whiteSpace: "nowrap" }}>
                      {new Date(g.updated_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Link
                          href={`/website/guides/${g.id}`}
                          className="btn btn-ghost"
                          style={{ padding: "5px 12px", fontSize: "0.8rem" }}
                        >
                          Edit
                        </Link>
                        {g.status === "published" && (
                          <a
                            href={`${site}/guides/${g.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost"
                            style={{ padding: "5px 12px", fontSize: "0.8rem" }}
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
