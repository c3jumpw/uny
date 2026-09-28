"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Reveal a stored credential on demand.
//
// Three deliberate behaviours:
//
//   1. The plaintext is fetched only on click and held in component
//      state, never rendered server-side. A vault tab left open on
//      a second monitor shows hints, not secrets.
//   2. It auto-hides after 45 seconds. The common case is "reveal,
//      copy, paste, move on" — leaving it on screen past that is
//      almost always forgetting rather than intending.
//   3. Copy puts it on the clipboard without ever displaying it, so
//      the usual reason to reveal does not require exposing it at
//      all.

const AUTO_HIDE_SECONDS = 45;

export function RevealCredential({
  integrationId,
  hint,
}: {
  integrationId: string;
  hint: string | null;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_HIDE_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hide = useCallback(() => {
    setVisible(false);
    setValue(null);
    setSecondsLeft(AUTO_HIDE_SECONDS);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          hide();
          return AUTO_HIDE_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, hide]);

  // Clear the secret from state if the component goes away.
  useEffect(() => () => hide(), [hide]);

  async function fetchCredential(): Promise<string | null> {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: integrationId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        credential?: string;
        error?: string;
        id?: string;
      };
      if (!res.ok || !j.credential) {
        setErr(j.error ?? "Could not reveal this credential.");
        return null;
      }
      // Guard against a slow response for a different card landing
      // here after the user moved on.
      if (j.id && j.id !== integrationId) return null;
      return j.credential;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reveal this credential.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onReveal() {
    if (visible) {
      hide();
      return;
    }
    const v = value ?? (await fetchCredential());
    if (!v) return;
    setValue(v);
    setSecondsLeft(AUTO_HIDE_SECONDS);
    setVisible(true);
  }

  async function onCopy() {
    const v = value ?? (await fetchCredential());
    if (!v) return;
    setValue(v);
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied permission):
      // showing it is the only remaining way to hand it over.
      setVisible(true);
      setSecondsLeft(AUTO_HIDE_SECONDS);
      setErr("Couldn't reach the clipboard — showing it instead so you can copy manually.");
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <code
          style={{
            padding: "5px 9px",
            borderRadius: 6,
            background: "var(--ink-2)",
            border: "1px solid var(--line)",
            color: visible ? "var(--paper)" : "var(--paper-dim)",
            fontSize: "0.75rem",
            wordBreak: "break-all",
            maxWidth: "100%",
            userSelect: visible ? "all" : "none",
          }}
        >
          {visible && value ? value : (hint ?? "••••••••")}
        </code>

        <button
          type="button"
          onClick={onReveal}
          disabled={busy}
          style={miniBtn}
          title={visible ? "Hide" : "Reveal the full credential"}
        >
          {busy && !visible ? "…" : visible ? "Hide" : "Reveal"}
        </button>

        <button
          type="button"
          onClick={onCopy}
          disabled={busy}
          style={miniBtn}
          title="Copy to clipboard without displaying it"
        >
          {copied ? "Copied" : "Copy"}
        </button>

        {visible ? (
          <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
            hides in {secondsLeft}s
          </span>
        ) : null}
      </div>

      {err ? (
        <div
          style={{
            marginTop: 6,
            fontSize: "0.75rem",
            color: "#ffb3b3",
          }}
        >
          {err}
        </div>
      ) : null}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--line)",
  background: "transparent",
  color: "var(--paper-dim)",
  fontSize: "0.72rem",
  cursor: "pointer",
};
