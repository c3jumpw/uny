import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";
import { audiencesFor, entriesFor, whatsNewFor } from "@/lib/changelog";
import { ChangelogView } from "@/components/changelog/ChangelogView";

// Admin → Change log: every change to UnyBase, as a timeline. Super
// admins see everything, internal notes included; technical admins see
// the changes that affect them and their clients. The record itself is
// src/lib/changelog.json in the repo, so it is versioned with the code
// and can be exported here as CSV or JSON.

export const metadata = { title: "Change log — UnyBase admin" };

export default async function ChangelogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getUserRole(user?.email);
  const entries = entriesFor(audiencesFor(role), { includeInternal: role === "super_admin" });
  const { freshIds } = user ? whatsNewFor(user, role) : { freshIds: [] as string[] };

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>Change log</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)", maxWidth: 760, lineHeight: 1.6 }}>
          Every change to UnyBase, in date order, with who it affects.{" "}
          {role === "super_admin"
            ? "Internal notes (website, build and infrastructure changes) show only here."
            : "You see the changes that affect technical admins and the clients you work with."}{" "}
          People see the changes that apply to them in a What&apos;s new window the first time they log in afterwards.
        </p>
      </div>
      <ChangelogView entries={entries} freshIds={freshIds} admin markSeen />
    </>
  );
}
