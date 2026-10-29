"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

// Re-sends the signup confirmation email. Used on the "check your
// inbox" page and on the login page when Supabase says the email
// is not confirmed yet (or the link expired).
export function ResendConfirmation({
  email: initialEmail,
  compact,
}: {
  email?: string;
  compact?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function resend() {
    if (!email.trim()) return;
    setState("sending");
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${APP_URL || window.location.origin}/auth/callback?flow=signup`,
      },
    });
    if (error) {
      setState("error");
      setMsg(
        /rate|seconds|too many/i.test(error.message)
          ? "Please wait a minute before asking for another email."
          : error.message
      );
      return;
    }
    setState("sent");
    setMsg("Sent. Check your inbox (and spam folder) for the newest email.");
  }

  return (
    <div style={{ marginTop: compact ? 8 : 16 }}>
      {initialEmail ? null : (
        <input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
          aria-label="Email to resend the confirmation to"
        />
      )}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={resend}
        disabled={state === "sending" || !email.trim()}
        style={{ width: compact ? undefined : "100%", padding: "8px 14px", fontSize: "0.85rem" }}
      >
        {state === "sending" ? "Sending…" : "Resend confirmation email"}
      </button>
      {msg ? (
        <p
          role="status"
          style={{
            margin: "8px 0 0",
            fontSize: "0.82rem",
            color: state === "error" ? "var(--danger)" : "#7CC084",
          }}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
