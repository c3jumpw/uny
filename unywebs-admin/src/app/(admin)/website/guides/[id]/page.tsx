import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteBase } from "@/lib/admin";
import type { GuideRow } from "@/lib/shared";
import { GuideEditor } from "@/components/GuideEditor";

export const metadata: Metadata = { title: "Edit guide" };

export default async function GuideEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("site_guides").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <>
      <p className="crumb">
        <Link href="/">Admin</Link> / Website / <Link href="/website/guides">Guides</Link>
      </p>
      <GuideEditor initial={data as GuideRow} siteBase={siteBase()} />
    </>
  );
}
