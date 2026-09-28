import { createClient } from "@/lib/supabase/server";
import { DomainsClient, type DomainRow } from "@/components/DomainsClient";

// Domains.
//
// Separate from the vault because a domain is not a credential: it
// has a registrar, nameservers, a certificate and a renewal date,
// and when it lapses the whole site goes dark rather than one
// feature degrading. Sorted soonest-expiry-first for that reason.

export default async function DomainsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data, error }, { data: credData }, { data: ownerData }] = await Promise.all([
    supabase.from("domains").select("*").order("created_at", { ascending: false }),
    supabase.from("integrations").select("id, name, workspace_owner_id"),
    supabase.rpc("integration_owner_emails"),
  ]);

  const domains = (data as DomainRow[] | null) ?? [];
  const creds =
    (credData as Array<{ id: string; name: string; workspace_owner_id: string }> | null) ??
    [];
  const myCreds = creds.filter((c) => c.workspace_owner_id === user?.id);

  const ownerEmails: Record<string, string> = {};
  for (const o of (ownerData as Array<{ owner_id: string; email: string }> | null) ?? []) {
    ownerEmails[o.owner_id] = o.email;
  }

  const systems = Array.from(
    new Set(
      domains
        .filter((d) => d.workspace_owner_id === user?.id)
        .map((d) => d.associated_system?.trim())
        .filter((s): s is string => Boolean(s))
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>Domains</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          Where each domain is registered, who owns the account, and when it renews.
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
          Could not load domains: {error.message}
        </div>
      ) : null}

      <DomainsClient
        domains={domains}
        systems={systems}
        credentials={myCreds.map((c) => ({ id: c.id, name: c.name }))}
        currentUserId={user?.id ?? null}
        ownerEmails={ownerEmails}
      />
    </>
  );
}
