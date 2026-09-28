"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    // Deliberately show the same confirmation whether or not the
    // address exists. Saying "no account with that email" turns the
    // reset form into a way to test which addresses are registered.
    if (error && !/rate|limit|seconds/i.test(error.message)) {
      setSent(true);
      return;
    }
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <div
          style={{
            padding: "14px 16px",
            marginBottom: 18,
            borderRadius: 8,
            background: "rgba(120,180,120,.1)",
            border: "1px solid rgba(120,180,120,.3)",
            color: "#9fe0a6",
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          If an account exists for <strong>{email.trim()}</strong>, a reset link is on
          its way. It expires in an hour.
        </div>
        <p
          style={{
            margin: "0 0 18px",
            color: "var(--paper-dim)",
            fontSize: "0.85rem",
            lineHeight: 1.6,
          }}
        >
          Nothing in your inbox after a couple of minutes? Check spam, and make sure you
          used the address you signed up with.
        </p>
        <Link href="/login" className="btn btn-ghost" style={{ width: "100%", display: "block", textAlign: "center" }}>
          Back to log in
        </Link>
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
        Enter the email you signed up with and we&apos;ll send you a link to set a new
        password.
      </p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        {loading ? "Sending…" : "Send reset link"}
      </button>
      <p
        style={{
          margin: "20px 0 0",
          color: "var(--paper-dim)",
          fontSize: "0.9rem",
          textAlign: "center",
        }}
      >
        Remembered it?{" "}
        <Link href="/login" style={{ color: "var(--sky)" }}>
          Log in
        </Link>
      </p>
    </form>
  );
}
