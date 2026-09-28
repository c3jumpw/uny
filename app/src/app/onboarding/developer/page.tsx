import { OnboardingShell } from "@/components/OnboardingShell";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Developer onboarding. The point of this page is to remove the
// dead end a new account used to land on: tell them exactly what
// they have, what happens next, and give them something they can
// act on in the next five minutes.

export default async function DeveloperOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: keyRow } = user
    ? await supabase
        .from("api_keys")
        .select("key")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const apiKey = (keyRow as { key: string } | null)?.key ?? null;

  return (
    <OnboardingShell
      title="You're set up. Here's what happens next."
      subtitle="Three things to know before you start wiring your app to UnyBase."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Step
          n={1}
          title="Your workspace is live"
          body="Your account is active and your dashboard is ready. Nothing else needs provisioning on your side."
        />
        <Step
          n={2}
          title="Your API key is issued"
          body={
            apiKey
              ? "It's on your dashboard, and it's yours for the life of the account. If your subscription ever lapses we deactivate the key rather than deleting it, so restoring access never means changing code."
              : "It'll appear on your dashboard shortly. It's yours for the life of the account."
          }
          code={apiKey ?? undefined}
        />
        <Step
          n={3}
          title="We'll reach out to connect your first service"
          body="Backend setup depends on what you're building, so we do this part with you rather than handing you a generic checklist. Expect to hear from us within one business day. If you'd rather kick it off now, email support@unywebs.com and tell us what you're connecting."
        />
      </div>

      <div
        style={{
          marginTop: 20,
          padding: "14px 16px",
          borderRadius: 10,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          color: "var(--paper-dim)",
          fontSize: "0.875rem",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--paper)" }}>Worth doing now:</strong> add your
        existing credentials to the{" "}
        <Link href="/dashboard/vault" style={{ color: "var(--sky)" }}>
          vault
        </Link>
        . UnyBase will check they still work and warn you before any of them expire &mdash;
        which is usually how integrations break, quietly and at the worst moment.
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/dashboard" className="btn btn-amber" style={{ padding: "10px 20px" }}>
          Go to dashboard
        </Link>
        <Link href="/dashboard/vault" className="btn btn-ghost" style={{ padding: "10px 20px" }}>
          Set up the vault
        </Link>
      </div>
    </OnboardingShell>
  );
}

function Step({
  n,
  title,
  body,
  code,
}: {
  n: number;
  title: string;
  body: string;
  code?: string;
}) {
  return (
    <div className="card" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div
        style={{
          flexShrink: 0,
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "rgba(242,169,59,.15)",
          border: "1px solid rgba(242,169,59,.35)",
          color: "var(--amber)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.8rem",
          fontWeight: 600,
        }}
      >
        {n}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <p
          style={{
            margin: 0,
            color: "var(--paper-dim)",
            fontSize: "0.875rem",
            lineHeight: 1.6,
          }}
        >
          {body}
        </p>
        {code ? (
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              borderRadius: 6,
              background: "var(--ink-2)",
              border: "1px solid var(--line)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.75rem",
              wordBreak: "break-all",
            }}
          >
            {code}
          </div>
        ) : null}
      </div>
    </div>
  );
}
