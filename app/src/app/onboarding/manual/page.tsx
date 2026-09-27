import { OnboardingShell } from "@/components/OnboardingShell";
import Link from "next/link";

// Guided (non-developer) onboarding. Same job as the developer
// page — no dead end — but pitched at someone who wants us to do
// the technical part rather than do it themselves.

export default function ManualOnboardingPage() {
  return (
    <OnboardingShell
      title="You're all set. We'll take it from here."
      subtitle="Your account is active. Here's what to expect."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Item
          title="Your workspace is ready"
          body="Everything is provisioned on our side. There's nothing technical for you to install or configure."
        />
        <Item
          title="We'll contact you within one business day"
          body="Someone from the team will get in touch to find out what you're building and connect the services it depends on — your site, your domain, your existing tools."
        />
        <Item
          title="Have your details handy"
          body="It speeds things up if you know where your domain is registered and which tools you're already using. If you're not sure, that's fine too — we'll work it out together."
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
        In the meantime your dashboard shows your subscription status and anything we&apos;ve
        set up so far. It&apos;ll fill out as we connect your services.
      </div>

      <div style={{ marginTop: 20 }}>
        <Link href="/dashboard" className="btn btn-amber" style={{ padding: "10px 20px" }}>
          Go to dashboard
        </Link>
      </div>
    </OnboardingShell>
  );
}

function Item({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
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
    </div>
  );
}
