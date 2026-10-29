import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "@/components/SignupForm";
import { ResendConfirmation } from "@/components/ResendConfirmation";
import { isCycle, isPlanId, planById } from "@/lib/plans";

function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ["Create account", "Confirm email", "Log in", "Choose plan & pay"];
  return (
    <ol
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 6,
        listStyle: "none",
        padding: 0,
        margin: "0 0 20px",
      }}
    >
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const now = n === current;
        return (
          <li key={s} style={{ fontSize: "0.72rem", lineHeight: 1.3, color: now ? "var(--paper)" : "var(--muted)" }}>
            <div
              style={{
                height: 3,
                borderRadius: 3,
                marginBottom: 6,
                background: done || now ? "var(--amber)" : "var(--line)",
                opacity: done ? 0.55 : 1,
              }}
            />
            {n}. {s}
          </li>
        );
      })}
    </ol>
  );
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string; sent?: string; email?: string }>;
}) {
  const { plan: rawPlan, cycle: rawCycle, sent, email } = await searchParams;
  const plan = isPlanId(rawPlan) ? rawPlan : undefined;
  const cycle = isCycle(rawCycle) ? rawCycle : undefined;

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={
          email
            ? `We sent a confirmation link to ${email}.`
            : "We sent you a confirmation link."
        }
      >
        <Steps current={2} />
        <ol style={{ margin: "0 0 4px", paddingLeft: 18, listStyle: "decimal", color: "var(--paper-dim)", fontSize: "0.9rem", lineHeight: 1.7 }}>
          <li>Open the email from UnyBase and press <strong style={{ color: "var(--paper)" }}>Confirm my email</strong>.</li>
          <li>You&apos;ll land on the login page &mdash; log in with the password you just chose.</li>
          <li>Pick monthly or yearly billing and complete checkout to activate your workspace.</li>
        </ol>
        <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
          It usually arrives within a minute. Not there? Check spam or promotions, then resend.
        </p>
        <ResendConfirmation email={email} />
        <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: "0.85rem" }}>
          <Link href="/login" style={{ color: "var(--sky)" }}>
            Already confirmed? Log in
          </Link>
        </p>
      </AuthShell>
    );
  }

  const p = planById(plan);
  const subtitle = p
    ? `You picked ${p.name}${cycle ? ` (${cycle})` : ""}. Create your account, then you'll confirm your email and check out.`
    : "Create your UnyBase account. You'll choose a plan after confirming your email.";

  return (
    <AuthShell title="Create your account" subtitle={subtitle}>
      <Steps current={1} />
      <SignupForm plan={plan} cycle={cycle} />
    </AuthShell>
  );
}
