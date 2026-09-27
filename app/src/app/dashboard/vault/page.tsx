import { createClient } from "@/lib/supabase/server";
import { VaultClient } from "@/components/VaultClient";
import type { Integration } from "@/lib/integrations";

// Integration health & credentials hub (phase 3).
//
// One place per workspace for every credential the client's app
// depends on: API keys, tokens, project URLs, callbacks. Each one
// carries the metadata that actually matters when things break at
// 2am — which account it lives under, whether that account is ours
// or the client's, when it expires, and whether it worked the last
// time we asked.
//
// RLS scopes what comes back: owners see their own, super admins
// see everything, technical admins see workspaces granted to them.

export default async function VaultPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .order("created_at", { ascending: false });

  const integrations = (data as Integration[] | null) ?? [];

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>
          Vault
        </h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          Every credential your app depends on, with live health checks and expiry
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

      <VaultClient integrations={integrations} />
    </>
  );
}
