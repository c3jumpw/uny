import { createClient } from "@/lib/supabase/server";
import { ChangesClient, type ChangeRequest, type Workspace } from "@/components/ChangesClient";

// Change requests: the running list of edits wanted in each app or
// tool, from "logged" to "sent to the developer" to "done". The done
// list doubles as a changelog.

export default async function ChangesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data, error }, { data: wsData }, { data: sysData }] = await Promise.all([
    supabase.from("change_requests").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.rpc("change_request_workspaces"),
    supabase.from("integrations").select("associated_system"),
  ]);

  const notReady = Boolean(error && /does not exist|schema cache|42P01/i.test(`${error.message} ${error.code}`));

  const workspaces: Workspace[] = ((wsData as Workspace[] | null) ?? []).filter(
    (w, i, arr) => arr.findIndex((x) => x.owner_id === w.owner_id) === i
  );
  if (!workspaces.some((w) => w.owner_id === user!.id)) {
    workspaces.unshift({ owner_id: user!.id, email: user!.email ?? "My workspace", access: "owner" });
  }

  const items = (data as ChangeRequest[] | null) ?? [];
  const systems = Array.from(
    new Set(
      [
        ...items.map((i) => i.associated_system),
        ...((sysData as Array<{ associated_system: string | null }> | null) ?? []).map((r) => r.associated_system),
      ]
        .map((s) => s?.trim())
        .filter((s): s is string => Boolean(s))
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>Change requests</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)", maxWidth: 720, lineHeight: 1.6 }}>
          Log every edit you want made to an app or tool, hand a batch to your developer with one copy, and
          keep a dated record of what&apos;s been done.
        </p>
      </div>

      {notReady ? (
        <div className="card" style={{ borderColor: "rgba(242,169,59,.4)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Almost ready</div>
          <p style={{ margin: 0, color: "var(--paper-dim)", fontSize: "0.9rem" }}>
            Change requests need one database update that hasn&apos;t been applied yet. Once it is, this page
            starts working with no other changes.
          </p>
        </div>
      ) : error ? (
        <div className="card" style={{ color: "#ffb3b3" }}>Could not load change requests: {error.message}</div>
      ) : (
        <ChangesClient
          initialItems={items}
          workspaces={workspaces}
          systems={systems}
          currentUserId={user!.id}
        />
      )}
    </>
  );
}
