import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";
import { getAccess } from "@/lib/access";
import { audiencesFor, entriesFor, whatsNewFor } from "@/lib/changelog";
import { ChangelogView } from "@/components/changelog/ChangelogView";

// What's new: every change that applies to you, newest first. Opening
// it counts as having seen them, so the popup won't repeat them.

export const metadata = { title: "What's new — UnyBase" };

export default async function WhatsNewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getUserRole(user?.email);
  const access = user ? await getAccess(supabase, user) : null;
  const collaboratorOnly = access?.reason === "collaborator";
  const entries = entriesFor(audiencesFor(role, { collaboratorOnly }));
  const { freshIds } = user ? whatsNewFor(user, role, { collaboratorOnly }) : { freshIds: [] as string[] };

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "var(--amber)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
          What&apos;s new
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>Every update to UnyBase</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)", maxWidth: 720, lineHeight: 1.6 }}>
          New features, improvements and fixes that apply to you. Anything added since your last visit is marked.
        </p>
      </div>
      <ChangelogView entries={entries} freshIds={freshIds} markSeen />
    </>
  );
}
