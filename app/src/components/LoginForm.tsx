"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ResendConfirmation } from "@/components/ResendConfirmation";

function safeNext(next?: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function friendlyLinkError(msg: string | null, code: string | null): string | null {
  if (!msg && !code) return null;
  if (code === "otp_expired" || /expired|invalid/i.test(msg ?? "")) {
    return "That confirmation link has expired or was already used. If you already confirmed, just log in. Otherwise, request a fresh link below.";
  }
  return msg;
}

export function LoginForm({
  next,
  confirmed,
  reset,
  linkError,
  linkErrorCode,
  plan,
}: {
  next?: string;
  confirmed?: boolean;
  reset?: boolean;
  linkError?: string | null;
  linkErrorCode?: string | null;
  plan?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hashError, setHashError] = useState<string | null>(null);

  // Supabase's implicit flow reports link problems in the URL
  // fragment (#error=…&error_code=otp_expired), which the server
  // never sees. Read it here so the person gets an explanation.
  useEffect(() => {
    const h = window.location.hash.replace(/^#/, "");
    if (!h) return;
    const p = new URLSearchParams(h);
    const msg = p.get("error_description");
    const code = p.get("error_code");
    if (msg || code) {
      setHashError(friendlyLinkError(msg, code));
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const linkProblem = friendlyLinkError(linkError ?? null, linkErrorCode ?? null) ?? hashError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnconfirmed(false);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      if (/not confirmed/i.test(error.message)) {
        setUnconfirmed(true);
        setError("You haven't confirmed your email yet. Open the confirmation email, or send a new one below.");
      } else if (/invalid login credentials/i.test(error.message)) {
        setError(
          "That email and password don't match. Check for typos, or use \"Forgot password?\" to set a new one."
        );
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    // The dashboard sends anyone without an active plan to /plans,
    // so only the plan hint needs carrying here.
    const dest =
      safeNext(next) ?? (plan === "basic" || plan === "premium" ? `/plans?plan=${plan}` : "/dashboard");
    router.push(dest);
    router.refresh();
  }

  const banner = (tone: "good" | "warn"): React.CSSProperties => ({
    padding: "10px 14px",
    marginBottom: 16,
    borderRadius: 8,
    fontSize: "0.88rem",
    lineHeight: 1.5,
    background: tone === "good" ? "rgba(120,180,120,.12)" : "rgba(242,169,59,.1)",
    border: `1px solid ${tone === "good" ? "rgba(120,180,120,.4)" : "rgba(242,169,59,.35)"}`,
  });

  return (
    <form onSubmit={handleSubmit}>
      {confirmed && !linkProblem ? (
        <div role="status" style={banner("good")}>
          ✓ Your email is confirmed. Log in to choose your plan and activate your workspace.
        </div>
      ) : null}
      {reset ? (
        <div role="status" style={banner("good")}>
          ✓ Password updated. Log in with your new password.
        </div>
      ) : null}
      {linkProblem ? (
        <div role="alert" style={banner("warn")}>
          {linkProblem}
          <ResendConfirmation compact />
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <label htmlFor="password">Password</label>
          <Link href="/forgot-password" style={{ color: "var(--sky)", fontSize: "0.8rem" }}>
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {unconfirmed ? <ResendConfirmation email={email.trim().toLowerCase()} compact /> : null}
        </div>
      ) : null}
      <button type="submit" className="btn btn-amber" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Logging in…" : "Log in"}
      </button>
      <p
        style={{
          margin: "20px 0 0",
          color: "var(--paper-dim)",
          fontSize: "0.9rem",
          textAlign: "center",
        }}
      >
        No account yet?{" "}
        <Link href="/start" style={{ color: "var(--sky)" }}>
          Get started
        </Link>
      </p>
    </form>
  );
}
