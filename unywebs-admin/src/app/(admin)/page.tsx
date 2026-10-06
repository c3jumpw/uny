import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { siteBase } from "@/lib/admin";

// The landing page of the parent company's console: what is live on the
// website, what changed recently, and where each product is run.

type EventRow = {
  id: string;
  actor_email: string;
  action: string;
  target_kind: string;
  target_slug: string | null;
  notes: string | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  solution_created: "added the tool",
  solution_published: "published the tool",
  solution_draft: "unpublished the tool",
  solution_archived: "archived the tool",
  guide_created: "started the guide",
  guide_published: "published the guide",
  guide_draft: "unpublished the guide",
  guide_archived: "archived the guide",
  media_uploaded: "uploaded",
};

export default async function OverviewPage() {
  const supabase = await createClient();

  const [solutions, guides, events] = await Promise.all([
    supabase.from("site_solutions").select("status"),
    supabase.from("site_guides").select("status"),
    supabase
      .from("site_content_events")
      .select("id, actor_email, action, target_kind, target_slug, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const count = (rows: { status: string }[] | null, status: string) =>
    (rows ?? []).filter((r) => r.status === status).length;

  const liveTools = count(solutions.data, "published");
  const liveGuides = count(guides.data, "published");
  const drafts = count(solutions.data, "draft") + count(guides.data, "draft");
  const site = siteBase();
  const unybaseApp = process.env.UNYBASE_APP_URL || "https://unybase.unywebs.com";
  const unybaseSite = process.env.UNYBASE_SITE_URL || "https://tryunybase.unywebs.com";

  // The log table is created by a migration; until it exists the query
  // errors, and the page says so plainly instead of showing an empty list
  // that looks like nobody has done anything.
  const logReady = !events.error;
  const recent = (events.data ?? []) as EventRow[];

  return (
    <>
      <div className="page-head">
        <h1>Unywebs Admin</h1>
        <p>The company console: the public website, and links to each product&apos;s own admin.</p>
      </div>

      <div className="stat-row">
        <Link href="/website/solutions" className="card stat">
          <div className="stat-num">{liveTools}</div>
          <div className="stat-label">Tools live on the site</div>
        </Link>
        <Link href="/website/guides" className="card stat">
          <div className="stat-num">{liveGuides}</div>
          <div className="stat-label">Guides published</div>
        </Link>
        <div className="card stat">
          <div className="stat-num">{drafts}</div>
          <div className="stat-label">Drafts not yet live</div>
        </div>
      </div>

      <div className="two-col">
        <section>
          <h2 className="section-title">Recent website changes</h2>
          <div className="card" style={{ padding: "6px 20px" }}>
            {!logReady ? (
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "14px 0" }}>
                The change log is not switched on yet. Edits save and publish
                normally; they are just not being recorded until its database
                table is added.
              </p>
            ) : recent.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "14px 0" }}>
                No changes recorded yet. Edits to tools and guides will appear here.
              </p>
            ) : (
              recent.map((e) => (
                <div className="event" key={e.id}>
                  <time dateTime={e.created_at}>
                    {new Date(e.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  <span>
                    <strong style={{ fontWeight: 600 }}>{e.actor_email}</strong>{" "}
                    {ACTION_LABEL[e.action] ?? e.action.replace(/_/g, " ")}{" "}
                    {e.notes ? <span style={{ color: "var(--paper-dim)" }}>{e.notes}</span> : null}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="section-title">Products</h2>
          <div className="card">
            <div className="product">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${site}/media/logos/unybase-icon.png`} alt="" />
              <div>
                <h3>UnyBase</h3>
                <p>
                  Managed backend product. Customers, subscriptions and
                  workspaces are run from its own admin.
                </p>
                <div className="link-list">
                  <a className="btn btn-ghost" href={`${unybaseApp}/admin`} target="_blank" rel="noopener noreferrer">
                    UnyBase admin ↗
                  </a>
                  <a className="btn btn-ghost" href={unybaseSite} target="_blank" rel="noopener noreferrer">
                    Product site ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
