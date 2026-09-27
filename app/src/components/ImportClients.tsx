"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportResult = {
  email: string;
  status: "created" | "already_exists" | "failed";
  detail?: string;
};

export function ImportClients() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [plan, setPlan] = useState("basic");
  const [markActive, setMarkActive] = useState(true);
  const [sendEmails, setSendEmails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  const count = emails
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@")).length;

  async function run() {
    setBusy(true);
    setErr(null);
    setResults(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          plan,
          mark_active: markActive,
          send_emails: sendEmails,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "Import failed.");
        return;
      }
      setResults((j as { results: ImportResult[] }).results);
      setSummary((j as { summary: Record<string, number> }).summary);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setEmails("");
    setResults(null);
    setSummary(null);
    setErr(null);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-amber"
        onClick={() => setOpen(true)}
        style={{ padding: "8px 14px", fontSize: "0.85rem" }}
      >
        Import subscribers
      </button>

      {open ? (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 560,
              width: "100%",
              marginTop: 24,
              marginBottom: 24,
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: "1.2rem" }}>Import subscribers</h2>
            <p
              style={{
                margin: "0 0 18px",
                color: "var(--paper-dim)",
                fontSize: "0.875rem",
                lineHeight: 1.6,
              }}
            >
              For people already paying through systeme.io who don&apos;t have a UnyBase
              account yet. We create the account, mark the subscription active so they
              aren&apos;t chased for a payment they&apos;re already making, and email them
              a link to set their own password.
            </p>

            {results ? (
              <ResultsView results={results} summary={summary} onDone={close} />
            ) : (
              <>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label style={lbl}>
                    Emails {count > 0 ? `(${count} detected)` : ""}
                  </label>
                  <textarea
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                    rows={6}
                    style={{ width: "100%", resize: "vertical" }}
                    placeholder={"Paste from anywhere — one per line, or comma separated.\n\nclient1@example.com\nclient2@example.com"}
                    autoFocus
                  />
                  <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                    Anyone who already has an account is skipped, so it&apos;s safe to
                    re-run this with the same list.
                  </small>
                </div>

                <div className="field" style={{ marginBottom: 14 }}>
                  <label style={lbl}>Plan to record</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                <label style={checkRow}>
                  <input
                    type="checkbox"
                    checked={markActive}
                    onChange={(e) => setMarkActive(e.target.checked)}
                  />
                  <span>
                    Mark subscription active
                    <small style={subNote}>
                      They&apos;re already paying in systeme.io, so leave this on unless
                      you&apos;re importing lapsed accounts.
                    </small>
                  </span>
                </label>

                <label style={checkRow}>
                  <input
                    type="checkbox"
                    checked={sendEmails}
                    onChange={(e) => setSendEmails(e.target.checked)}
                  />
                  <span>
                    Email them a set-password link
                    <small style={subNote}>
                      Turn off for a dry run, or if you want to tell them yourself first.
                    </small>
                  </span>
                </label>

                {err ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      margin: "12px 0",
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
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 20,
                  }}
                >
                  <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-amber"
                    onClick={run}
                    disabled={busy || count === 0}
                  >
                    {busy ? "Importing…" : `Import ${count || ""}`.trim()}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ResultsView({
  results,
  summary,
  onDone,
}: {
  results: ImportResult[];
  summary: Record<string, number> | null;
  onDone: () => void;
}) {
  return (
    <>
      {summary ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <Pill n={summary.created} label="created" color="#7CC084" />
          <Pill n={summary.already_exists} label="already had accounts" color="#9C9488" />
          <Pill n={summary.failed} label="failed" color="#ffb3b3" />
        </div>
      ) : null}

      <div
        style={{
          maxHeight: 280,
          overflowY: "auto",
          border: "1px solid var(--line)",
          borderRadius: 8,
        }}
      >
        <table className="tbl">
          <tbody>
            {results.map((r) => (
              <tr key={r.email}>
                <td style={{ fontSize: "0.85rem" }}>{r.email}</td>
                <td style={{ textAlign: "right", fontSize: "0.8rem" }}>
                  <span
                    style={{
                      color:
                        r.status === "created"
                          ? "#7CC084"
                          : r.status === "failed"
                            ? "#ffb3b3"
                            : "var(--muted)",
                    }}
                  >
                    {r.status === "created"
                      ? "Created"
                      : r.status === "already_exists"
                        ? "Already existed"
                        : `Failed — ${r.detail ?? "unknown"}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <button type="button" className="btn btn-amber" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
}

function Pill({ n, label, color }: { n: number; label: string; color: string }) {
  if (!n) return null;
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: "0.75rem",
        color,
        border: `1px solid ${color}44`,
        background: `${color}14`,
      }}
    >
      {n} {label}
    </span>
  );
}

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  color: "var(--paper-dim)",
  marginBottom: 4,
};

const checkRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  marginBottom: 12,
  fontSize: "0.875rem",
  cursor: "pointer",
};

const subNote: React.CSSProperties = {
  display: "block",
  color: "var(--muted)",
  fontSize: "0.75rem",
  marginTop: 2,
};
