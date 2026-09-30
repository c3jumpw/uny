"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewGuideButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/guides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled guide" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(json.error || "Could not create the guide.");
      return;
    }
    router.push(`/admin/guides/${json.guide.id}`);
  }

  return (
    <div style={{ textAlign: "right" }}>
      <button className="btn btn-amber" onClick={create} disabled={busy}>
        {busy ? "Creating…" : "New guide"}
      </button>
      {error && (
        <div style={{ color: "#ffb3b3", fontSize: "0.8rem", marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}
