"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type VaultShare = {
  id: string;
  grantee_email: string;
  scope_type: "all" | "system" | "integration";
  scope_value: string | null;
  scope_label: string | null;
  note: string | null;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export function VaultSharing({
  shares,
  systems,
  integrations,
}: {
  shares: VaultShare[];
  systems: string[];
  integrations: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [scopeType, setScopeType] = useState<"all" | "system" | "integration">(
    systems.length > 0 ? "system" : "all"
  );
  const [scopeValue, setScopeValue] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("never");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const active = shares.filter(
    (s) => !s.revoked_at && (!s.expires_at || new Date(s.expires_at) > new Date())
  );

  async function share() {
    if (!email.trim()) {
      setErr("Enter an email address.");
      return;
    }
    if (scopeType !== "all" && !scopeValue) {
      setErr(
        scopeType === "system"
          ? "Pick which system to share."
          : "Pick which credential to share."
      );
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/vault/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          scope_type: scopeType,
          scope_value: scopeType === "all" ? null : scopeValue,
          note: note.trim() || undefined,
          expires_in_days:
            expiresInDays === "never" ? undefined : Number(expiresInDays),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "Could not share.");
        return;
      }
      setEmail("");
      setNote("");
      setScopeValue("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not share.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, who: string, what: string) {
    if (!confirm(`Stop sharing ${what} with ${who}?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/vault/shares?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Sharing</div>
          <div style={{ color: "var(--paper-dim)", fontSize: "0.85rem" }}>
            {active.length === 0
              ? "Nobody else can see these credentials."
              : `Shared with ${active.length} ${
                  active.length === 1 ? "person" : "people"
                }.`}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setOpen(!open);
            setErr(null);
          }}
          style={{ padding: "7px 14px", fontSize: "0.85rem" }}
        >
          {open ? "Close" : "Share credentials"}
        </button>
      </div>

      {active.length > 0 ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {active.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--ink-2)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontSize: "0.85rem", minWidth: 0 }}>
                <span style={{ color: "var(--paper)" }}>{s.grantee_email}</span>
                <span style={{ color: "var(--muted)" }}> &mdash; </span>
                <span style={{ color: "var(--sky)" }}>
                  {s.scope_label ?? "All credentials"}
                </span>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  {s.expires_at
                    ? `Expires ${new Date(s.expires_at).toLocaleDateString()}`
                    : "No expiry"}
                  {s.note ? ` · ${s.note}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  revoke(s.id, s.grantee_email, s.scope_label ?? "these credentials")
                }
                disabled={busy}
                style={{ padding: "5px 12px", fontSize: "0.75rem" }}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {open ? (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            <div className="field" style={{ marginBottom: 0 }}>
              <label style={lbl}>Their email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                style={{ width: "100%" }}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label style={lbl}>What to share</label>
              <select
                value={scopeType}
                onChange={(e) => {
                  setScopeType(e.target.value as "all" | "system" | "integration");
                  setScopeValue("");
                }}
                style={{ width: "100%" }}
              >
                <option value="system">A project / system</option>
                <option value="integration">One credential</option>
                <option value="all">Everything</option>
              </select>
            </div>

            {scopeType === "system" ? (
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={lbl}>Which system</label>
                <select
                  value={scopeValue}
                  onChange={(e) => setScopeValue(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Choose…</option>
                  {systems.map((sys) => (
                    <option key={sys} value={sys}>
                      {sys}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {scopeType === "integration" ? (
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={lbl}>Which credential</label>
                <select
                  value={scopeValue}
                  onChange={(e) => setScopeValue(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Choose…</option>
                  {integrations.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="field" style={{ marginBottom: 0 }}>
              <label style={lbl}>Access expires</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="never">Until I revoke it</option>
                <option value="7">In 7 days</option>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 12, marginBottom: 12 }}>
            <label style={lbl}>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. contractor on the storefront rebuild"
              style={{ width: "100%" }}
            />
          </div>

          {err ? (
            <div
              style={{
                padding: "10px 12px",
                marginBottom: 12,
                border: "1px solid rgba(240,80,80,.3)",
                background: "rgba(240,80,80,.1)",
                color: "#ffb3b3",
                borderRadius: 8,
                fontSize: "0.85rem",
              }}
            >
              {err}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <small style={{ color: "var(--muted)", fontSize: "0.75rem", maxWidth: 380 }}>
              They&apos;ll get an email. If they don&apos;t have a UnyBase account yet,
              the share activates automatically when they sign up with this address.
            </small>
            <button
              type="button"
              className="btn btn-amber"
              onClick={share}
              disabled={busy}
              style={{ padding: "8px 16px", fontSize: "0.85rem" }}
            >
              {busy ? "Sharing…" : "Share"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "var(--paper-dim)",
  marginBottom: 4,
};
