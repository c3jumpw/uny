import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { siteBase } from "@/lib/admin";
import type { SolutionRow } from "@/lib/shared";
import { SolutionsAdmin } from "@/components/SolutionsAdmin";

export const metadata: Metadata = { title: "Solutions" };

export default async function SolutionsPage() {
  // Runs as the signed-in admin, so drafts and archived tools are visible
  // through the admin policy, not through any elevated key.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_solutions")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <>
      <p className="crumb">
        <Link href="/">Admin</Link> / Website / Solutions
      </p>
      {error ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--danger)" }}>
            The tools could not be loaded: {error.message}
          </p>
        </div>
      ) : (
        <SolutionsAdmin initial={(data ?? []) as SolutionRow[]} siteBase={siteBase()} />
      )}
    </>
  );
}
