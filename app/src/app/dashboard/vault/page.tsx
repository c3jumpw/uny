import { createClient } from "@/lib/supabase/server";
import { VaultClient } from "@/components/VaultClient";
import { VaultSharing, type VaultShare } from "@/components/VaultSharing";
import type { Integration } from "@/lib/integrations";
import type { IntegrationEvent } from "@/components/VaultClient";

// Integration health & credentials hub.
//
// RLS decides what comes back: your own credentials, anything a
// super admin can see, workspaces granted via technical-admin
// grants, and anything shared with your email address through
// vault_shares. A shared row looks like any other except for the
// owner label, so a contractor with access to one project sees a
// vault containing exactly those credentials.

export default async function VaultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data, error }, { data: shareData }, { data: ownerData }, { data: eventData }] =
    await Promise.all([
      supabase.from("integrations").select("*").order("created_at", { ascending: false }),
      supabase.rpc("list_my_vault_shares"),
      supabase.rpc("integration_owner_emails"),
      supabase
        .from("integration_events")
        .select("integration_id, actor_email, event_type, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

  const integrations = (data as Integration[] | null) ?? [];
  const shares = (shareData as VaultShare[] | null) ?? [];

  const ownerEmails = new Map<string, string>();
  for (const o of (ownerData as Array<{ owner_id: string; email: string }> | null) ?? []) {
    ownerEmails.set(o.owner_id, o.email);
  }

  // Group the audit trail per credential, newest first, capped so a
  // noisy integration cannot flood the page.
  const events: Record<string, IntegrationEvent[]> = {};
  for (const e of (eventData as IntegrationEvent[] | null) ?? []) {
    const list = (events[e.integration_id] ??= []);
    if (list.length < 8) list.push(e);
  }

  const mine = integrations.filter((i) => i.workspace_owner_id === user?.id);
  const systems = Array.from(
    new Set(
      mine.map((i) => i.associated_system?.trim()).filter((s): s is string => Boolean(s))
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>Vault</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          Every credential your apps depend on, with live health checks and expiry
          warnings. Credentials are encrypted before they reach the database.
        </p>
      </div>

      {error ? (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            border: "1px solid rgba(240,80,80,.3)",
            background: "rgba(240,80,80,.1)",
            color: "#ffb3b3",
            borderRadius: 8,
            fontSize: "0.85rem",
          }}
        >
          Could not load integrations: {error.message}
        </div>
      ) : null}

      <VaultSharing
        shares={shares}
        systems={systems}
        integrations={mine.map((i) => ({ id: i.id, name: i.name }))}
      />

      <VaultClient
        integrations={integrations}
        currentUserId={user?.id ?? null}
        ownerEmails={Object.fromEntries(ownerEmails)}
        events={events}
      />
    </>
  );
}
