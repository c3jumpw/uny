"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next, unybaseUrl }: { next: string; unybaseUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "That email and password don't match. Check both and try again."
          : error.message
      );
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
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
        <label htmlFor="password">Password</label>
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
        <div role="alert" className="alert">
          {error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      {/* Accounts are shared across Unywebs and its products, so a reset
          done in UnyBase applies here too. */}
      <p style={{ margin: "18px 0 0", color: "var(--muted)", fontSize: "0.84rem", textAlign: "center" }}>
        Same email and password as your UnyBase account.{" "}
        <a href={`${unybaseUrl}/forgot-password`} style={{ color: "var(--sky)" }}>
          Reset password
        </a>
      </p>
    </form>
  );
}
