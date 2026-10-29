"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

function appOrigin() {
  // Always send confirmation links to the canonical domain, even if
  // someone signs up from a preview or *.vercel.app address.
  return APP_URL || window.location.origin;
}

export function SignupForm({ plan, cycle }: { plan?: string; cycle?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    email.trim().length > 0 && password.length >= 8 && confirm.length > 0 && !mismatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setTouchedConfirm(true);
      setError("The two passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        // flow=signup tells the callback this is an email confirmation,
        // which always lands on the login page.
        emailRedirectTo: `${appOrigin()}/auth/callback?flow=signup`,
        data: {
          ...(plan ? { intended_plan: plan } : {}),
          ...(cycle ? { intended_cycle: cycle } : {}),
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Tag the new contact in systeme.io. Fire-and-forget: a tagging
    // hiccup must never block someone from creating an account.
    fetch("/api/auth/signup-tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail }),
      keepalive: true,
    }).catch(() => {});

    router.push(`/signup?sent=1&email=${encodeURIComponent(cleanEmail)}`);
  }

  const fieldError: React.CSSProperties = {
    display: "block",
    marginTop: 6,
    color: "var(--danger)",
    fontSize: "0.8rem",
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
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
        <small style={{ display: "block", marginTop: 6, color: "var(--muted)", fontSize: "0.78rem" }}>
          Use the same email at checkout &mdash; that&apos;s how your payment is matched to this account.
        </small>
      </div>
      <div className="field">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label htmlFor="password">Password</label>
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            style={{
              background: "none",
              border: 0,
              padding: 0,
              color: "var(--sky)",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            {show ? "Hide" : "Show"} passwords
          </button>
        </div>
        <input
          id="password"
          type={show ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-help"
        />
        <small
          id="password-help"
          style={tooShort ? fieldError : { display: "block", marginTop: 6, color: "var(--muted)", fontSize: "0.78rem" }}
        >
          At least 8 characters{tooShort ? ` — ${8 - password.length} more to go` : ""}.
        </small>
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          type={show ? "text" : "password"}
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setTouchedConfirm(true)}
          aria-invalid={mismatch}
          aria-describedby="confirm-help"
          style={
            mismatch && touchedConfirm
              ? { borderColor: "rgba(229,72,77,.6)" }
              : confirm.length > 0 && !mismatch
                ? { borderColor: "rgba(120,180,120,.6)" }
                : undefined
          }
        />
        {mismatch && (touchedConfirm || confirm.length >= password.length) ? (
          <small id="confirm-help" role="alert" style={fieldError}>
            Passwords don&apos;t match yet.
          </small>
        ) : confirm.length > 0 && !mismatch ? (
          <small id="confirm-help" style={{ display: "block", marginTop: 6, color: "#7CC084", fontSize: "0.8rem" }}>
            ✓ Passwords match
          </small>
        ) : null}
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
      <button type="submit" className="btn btn-amber" style={{ width: "100%" }} disabled={!canSubmit}>
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p
        style={{
          margin: "20px 0 0",
          color: "var(--paper-dim)",
          fontSize: "0.9rem",
          textAlign: "center",
        }}
      >
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--sky)" }}>
          Log in
        </Link>
      </p>
    </form>
  );
}
