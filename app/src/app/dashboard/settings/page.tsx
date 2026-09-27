import { createClient } from "@/lib/supabase/server";
import { GrantsClient, type Grant } from "@/components/GrantsClient";

// Workspace settings. Right now this is access control: who else
// can see this workspace. The grants issued here are what the
// technical_admin role actually reads — holding the role grants
// nothing on its own.

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_my_grants");
  const grants = (data as Grant[] | null) ?? [];

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>
          Settings
        </h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          Control who can access your workspace.
        </p>
      </div>
      <GrantsClient grants={grants} />
    </>
  );
}
