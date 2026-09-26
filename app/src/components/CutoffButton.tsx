"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CutoffButton({
  targetUserId,
  targetEmail,
  currentlyActive,
}: {
  targetUserId: string;
  targetEmail: string;
  currentlyActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const action = currentlyActive ? "cutoff" : "restore";
  const gateWord = action === "cutoff" ? "CUTOFF" : "RESTORE";
  const canSubmit = confirm === gateWord && !busy;

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/cutoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: targetUserId,
          action,
          reason: reason.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "failed");
        setBusy(false);
        return;
      }
      setOpen(false);
      setConfirm("");
      setReason("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={action === "cutoff" ? "btn btn-danger" : "btn btn-primary"}
        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
      >
        {action === "cutoff" ? "Cut off" : "Restore"}
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
              {action === "cutoff" ? "Cut off automations?" : "Restore automations?"}
            </h2>
            <p style={{ margin: "0 0 16px", color: "var(--paper-dim)", fontSize: "0.9rem" }}>
              {action === "cutoff" ? (
                <>
                  This will pause automations for <strong>{targetEmail}</strong> and revoke
                  their API key. They will lose access to the UnyBase backend until you
                  restore. They will be notified by email (once SMTP is configured).
                </>
              ) : (
                <>
                  This will resume automations for <strong>{targetEmail}</strong> and
                  un-revoke their API key. Existing integrations will start working again
                  without needing a new key.
                </>
              )}
            </p>

            {action === "cutoff" ? (
              <div className="field" style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    color: "var(--paper-dim)",
                    marginBottom: 4,
                  }}
                >
                  Reason (optional, saved to audit trail)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  style={{ width: "100%", resize: "vertical" }}
                  placeholder="e.g. 15 days lapsed, no client response"
                />
              </div>
            ) : null}

            <div className="field" style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "var(--paper-dim)",
                  marginBottom: 4,
                }}
              >
                Type <code style={{ color: "var(--amber)" }}>{gateWord}</code> to confirm
              </label>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.toUpperCase())}
                style={{ width: "100%", letterSpacing: "0.05em" }}
                autoFocus
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={action === "cutoff" ? "btn btn-danger" : "btn btn-primary"}
                onClick={submit}
                disabled={!canSubmit}
              >
                {busy ? "Working…" : action === "cutoff" ? "Cut off" : "Restore"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
