"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Grant = {
  id: string;
  technical_admin_email: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  note: string | null;
};

export function GrantsClient({ grants }: { grants: Grant[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("never");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const active = grants.filter(
    (g) => !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > new Date())
  );
  const inactive = grants.filter((g) => !active.includes(g));

  async function grant() {
    if (!email.trim()) {
      setErr("Enter the email of the person you want to grant access to.");
      return;
    }
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          note: note.trim() || undefined,
          expires_in_days:
            expiresInDays === "never" ? undefined : Number(expiresInDays),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "Could not grant access.");
        return;
      }
      setOk(`Access granted to ${email.trim()}. They've been notified by email.`);
      setEmail("");
      setNote("");
      setExpiresInDays("never");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not grant access.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, who: string) {
    if (
      !confirm(
        `Revoke access for ${who}? They'll lose visibility of your workspace immediately.`
      )
    )
      return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await fetch(`/api/grants?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setOk(`Access revoked for ${who}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 600 }}>
          Grant access
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            color: "var(--paper-dim)",
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          Give a technical admin permission to see and manage this workspace. They&apos;ll
          be able to view your subscription status and integrations, and act on your
          behalf when you ask them to. You can revoke this at any time.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
              Their email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@agency.com"
              style={{ width: "100%" }}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
              Access expires
            </label>
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

        <div className="field" style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
            Note (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. helping with the Stripe migration"
            style={{ width: "100%" }}
          />
        </div>

        {err ? (
          <div style={alertStyle("error")}>{err}</div>
        ) : ok ? (
          <div style={alertStyle("ok")}>{ok}</div>
        ) : null}

        <button
          type="button"
          className="btn btn-amber"
          onClick={grant}
          disabled={busy}
          style={{ padding: "9px 18px", fontSize: "0.875rem" }}
        >
          {busy ? "Working…" : "Grant access"}
        </button>
      </div>

      <h2 style={{ margin: "0 0 12px", fontSize: "1.05rem", fontWeight: 600 }}>
        Who has access
      </h2>

      {active.length === 0 ? (
        <div className="card" style={{ color: "var(--paper-dim)", fontSize: "0.9rem" }}>
          No one else has access to this workspace. Only you can see it.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {active.map((g) => (
            <div
              key={g.id}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{g.technical_admin_email}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--paper-dim)" }}>
                  Granted {new Date(g.granted_at).toLocaleDateString()}
                  {g.expires_at
                    ? ` · expires ${new Date(g.expires_at).toLocaleDateString()}`
                    : " · no expiry"}
                  {g.note ? ` · ${g.note}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => revoke(g.id, g.technical_admin_email)}
                disabled={busy}
                style={{ padding: "6px 14px", fontSize: "0.8rem" }}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {inactive.length > 0 ? (
        <>
          <h3
            style={{
              margin: "24px 0 10px",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "var(--paper-dim)",
            }}
          >
            Past access
          </h3>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="tbl">
              <tbody>
                {inactive.map((g) => (
                  <tr key={g.id}>
                    <td style={{ color: "var(--paper-dim)" }}>
                      {g.technical_admin_email}
                    </td>
                    <td
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.8rem",
                        textAlign: "right",
                      }}
                    >
                      {g.revoked_at
                        ? `Revoked ${new Date(g.revoked_at).toLocaleDateString()}`
                        : `Expired ${new Date(g.expires_at!).toLocaleDateString()}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}

function alertStyle(kind: "error" | "ok"): React.CSSProperties {
  const isErr = kind === "error";
  return {
    padding: "10px 12px",
    marginBottom: 12,
    borderRadius: 8,
    fontSize: "0.85rem",
    border: `1px solid ${isErr ? "rgba(240,80,80,.3)" : "rgba(120,180,120,.3)"}`,
    background: isErr ? "rgba(240,80,80,.1)" : "rgba(120,180,120,.1)",
    color: isErr ? "#ffb3b3" : "#9fe0a6",
  };
}
