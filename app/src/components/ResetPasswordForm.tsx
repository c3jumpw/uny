"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Set a new password.
//
// Supabase delivers recovery either as a code in the query string
// (PKCE, the newer flow) or as tokens in the URL fragment (the
// older implicit flow). The client library handles both on load and
// leaves us with a session, so rather than parsing the URL we just
// wait for the session to appear and report a clear error if it
// never does — which is what an expired or already-used link looks
// like from here.

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        settled = true;
        setReady("ok");
      } else if (event === "SIGNED_OUT") {
        settled = true;
        setReady("invalid");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setReady("ok");
      }
    });

    // The library processes the URL asynchronously. If nothing has
    // produced a session shortly after mount, the link is no good.
    const timer = setTimeout(() => {
      if (!settled) setReady("invalid");
    }, 3000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  if (ready === "checking") {
    return (
      <p style={{ margin: 0, color: "var(--paper-dim)", fontSize: "0.9rem" }}>
        Checking your link…
      </p>
    );
  }

  if (ready === "invalid") {
    return (
      <div>
        <div
          style={{
            padding: "14px 16px",
            marginBottom: 18,
            borderRadius: 8,
            background: "rgba(229,72,77,.1)",
            border: "1px solid rgba(229,72,77,.35)",
            color: "var(--danger)",
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          This reset link has expired or has already been used.
        </div>
        <p
          style={{
            margin: "0 0 18px",
            color: "var(--paper-dim)",
            fontSize: "0.85rem",
            lineHeight: 1.6,
          }}
        >
          Links are single-use and last an hour. Request a fresh one and it&apos;ll work.
        </p>
        <Link
          href="/forgot-password"
          className="btn btn-amber"
          style={{ width: "100%", display: "block", textAlign: "center" }}
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 8,
          background: "rgba(120,180,120,.1)",
          border: "1px solid rgba(120,180,120,.3)",
          color: "#9fe0a6",
          fontSize: "0.9rem",
          lineHeight: 1.6,
        }}
      >
        Password updated. Taking you to your dashboard…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p
        style={{
          margin: "0 0 18px",
          color: "var(--paper-dim)",
          fontSize: "0.9rem",
          lineHeight: 1.6,
        }}
      >
        Choose a new password for your account.
      </p>
      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirm new password</label>
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error ? (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 8,
            background: "rgba(229,72,77,.1)",
            border: "1px solid rgba(229,72,77,.35)",
            color: "var(--danger)",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-amber" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
