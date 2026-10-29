"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Backfills segment tags for accounts created before tagging existed
// (or while the API key was missing).
export function SystemeSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/systeme-sync", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        tagged_signup?: number;
        tagged_customer?: number;
        failed?: number;
        activated?: number;
      };
      if (!res.ok) setMsg(j.error ?? "Failed.");
      else
        setMsg(
          `Signup tags: ${j.tagged_signup ?? 0} · customer tags: ${j.tagged_customer ?? 0} · newly confirmed payments: ${j.activated ?? 0}${
            j.failed ? ` · failed: ${j.failed}` : ""
          }`
        );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: "right" }}>
      <button type="button" className="btn btn-ghost" onClick={run} disabled={busy} style={{ fontSize: "0.82rem" }}>
        {busy ? "Syncing…" : "Sync tags now"}
      </button>
      {msg ? <div style={{ fontSize: "0.75rem", color: "var(--paper-dim)", marginTop: 4 }}>{msg}</div> : null}
    </div>
  );
}
