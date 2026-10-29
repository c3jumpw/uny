"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [14, 30, 60, 90];

function isoDateIn(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export function TrialButton({
  targetUserId,
  targetEmail,
  trialEndsAt,
  trialConverted,
  trialNote,
}: {
  targetUserId: string;
  targetEmail: string;
  trialEndsAt: string | null;
  trialConverted: boolean;
  trialNote: string | null;
}) {
  const router = useRouter();
  const running = Boolean(trialEndsAt && !trialConverted && new Date(trialEndsAt).getTime() > Date.now());
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(
    running && trialEndsAt ? trialEndsAt.slice(0, 10) : isoDateIn(14)
  );
  const [note, setNote] = useState(trialNote ?? "");
  const [notify, setNotify] = useState(true);
  const [shareNote, setShareNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: targetUserId, ...payload }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Failed.");
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

  const label = running
    ? `Trial → ${new Date(trialEndsAt!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "Trial";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost"
        title={running ? "Extend, convert or end this trial" : "Give this account a manual trial"}
        style={{
          padding: "6px 12px",
          fontSize: "0.8rem",
          ...(running ? { color: "#6ec8d8", borderColor: "rgba(90,190,215,.4)" } : {}),
        }}
      >
        {label}
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
              maxWidth: 500,
              width: "100%",
              textAlign: "left",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: "1.2rem" }}>
              {running ? "Manage trial" : "Start a manual trial"}
            </h2>
            <p style={{ margin: "0 0 16px", color: "var(--paper-dim)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--paper)" }}>{targetEmail}</strong>{" "}
              {running
                ? `is on a trial until ${new Date(trialEndsAt!).toLocaleDateString()}. Change the date to extend or shorten it.`
                : "gets full dashboard access, without paying, until the date below. When it ends they see the plan picker at login. Nothing is deleted."}
            </p>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setDate(isoDateIn(d))}
                  style={{
                    padding: "5px 10px",
                    fontSize: "0.8rem",
                    ...(date === isoDateIn(d) ? { borderColor: "var(--amber)", color: "var(--amber)" } : {}),
                  }}
                >
                  {d} days
                </button>
              ))}
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--paper-dim)", marginBottom: 4 }}>
                Trial ends on (end of day, UTC)
              </label>
              <input
                type="date"
                value={date}
                min={isoDateIn(1)}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--paper-dim)", marginBottom: 4 }}>
                Note (internal)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Demo call 28 Oct — evaluating for 3 client sites"
                style={{ width: "100%" }}
              />
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", marginBottom: 6 }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              Email them that the trial is on (with the end date)
            </label>
            {notify && note.trim() ? (
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", marginBottom: 6, paddingLeft: 24 }}>
                <input type="checkbox" checked={shareNote} onChange={(e) => setShareNote(e.target.checked)} />
                Include the note in that email
              </label>
            ) : null}
            <p style={{ margin: "4px 0 16px", color: "var(--muted)", fontSize: "0.75rem" }}>
              They&apos;re reminded 3 days and 1 day before it ends. Super admins get alerts at 7, 3 and 1 days.
            </p>

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

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {running ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => send({ action: "convert", note: note.trim() || null })}
                      title="They paid outside the normal checkout"
                      style={{ fontSize: "0.85rem" }}
                    >
                      Mark converted
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={() => send({ action: "end", note: note.trim() || null })}
                      style={{ fontSize: "0.85rem" }}
                    >
                      End now
                    </button>
                  </>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-amber"
                  disabled={busy || !date}
                  onClick={() =>
                    send({
                      action: "grant",
                      ends_at: date,
                      note: note.trim() || null,
                      notify,
                      share_note: shareNote,
                    })
                  }
                >
                  {busy ? "Working…" : running ? "Update trial" : "Start trial"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
