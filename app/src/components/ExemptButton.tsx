"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExemptButton({
  targetUserId,
  targetEmail,
  currentlyExempt,
  currentReason,
}: {
  targetUserId: string;
  targetEmail: string;
  currentlyExempt: boolean;
  currentReason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(currentReason ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(exempt: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/exempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: targetUserId,
          exempt,
          reason: reason.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "Failed.");
        setBusy(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost"
        title={
          currentlyExempt
            ? "This workspace is exempt from billing"
            : "Exempt this workspace from billing"
        }
        style={{
          padding: "6px 12px",
          fontSize: "0.8rem",
          ...(currentlyExempt
            ? { color: "#b79be8", borderColor: "rgba(150,110,220,.35)" }
            : {}),
        }}
      >
        {currentlyExempt ? "Exempt ✓" : "Exempt"}
      </button>

      {open ? (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: "100%",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: "1.2rem" }}>
              {currentlyExempt ? "Billing exemption" : "Exempt from billing"}
            </h2>
            <p
              style={{
                margin: "0 0 16px",
                color: "var(--paper-dim)",
                fontSize: "0.9rem",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "var(--paper)" }}>{targetEmail}</strong>
              {currentlyExempt
                ? " is currently exempt. Payment tracking, lapse warnings and plan nudges are all switched off for this workspace."
                : " will be treated as an internal workspace: no lapse clock, no cutoff recommendations, no plan-selection nudges, and no payment-failure emails. Everything else — vault, integrations, health checks — works normally."}
            </p>

            <div className="field" style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "var(--paper-dim)",
                  marginBottom: 4,
                }}
              >
                Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Internal — company web tools credential store"
                style={{ width: "100%" }}
                autoFocus
              />
              <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                Shown on the workspace&apos;s own dashboard and saved to the audit trail.
              </small>
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              {currentlyExempt ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => submit(false)}
                  disabled={busy}
                >
                  {busy ? "Working…" : "Remove exemption"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-amber"
                onClick={() => submit(true)}
                disabled={busy}
              >
                {busy
                  ? "Working…"
                  : currentlyExempt
                    ? "Update reason"
                    : "Exempt from billing"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
