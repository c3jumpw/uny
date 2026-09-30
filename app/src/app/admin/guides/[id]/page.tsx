import Link from "next/link";
import { notFound } from "next/navigation";
import { serviceClient, type GuideRow } from "@/lib/siteContent";
import { ContentTabs } from "@/components/ContentTabs";
import { GuideEditor } from "@/components/GuideEditor";

export const dynamic = "force-dynamic";

export default async function GuideEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = serviceClient();

  if (!admin) {
    return (
      <>
        <ContentTabs />
        <div className="card" style={{ padding: 24 }}>
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
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <>
      <ContentTabs />
      <p style={{ marginTop: 0, marginBottom: 16, fontSize: "0.85rem" }}>
        <Link href="/admin/guides" style={{ color: "var(--paper-dim)" }}>
          &larr; All guides
        </Link>
      </p>
      <GuideEditor
        initial={data as GuideRow}
        siteBase={(process.env.MARKETING_SITE_URL || "").replace(/\/$/, "")}
      />
    </>
  );
}
