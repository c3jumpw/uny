import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "@/components/SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; sent?: string }>;
}) {
  const { plan, sent } = await searchParams;

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="We sent you a confirmation link. Open it to finish creating your account."
      >
        <p style={{ margin: 0, color: "var(--paper-dim)", fontSize: "0.9rem" }}>
          The email should arrive in the next minute. Check your spam folder if it doesn&apos;t.
        </p>
      </AuthShell>
    );
  }

  const subtitle = plan
    ? `You picked the ${plan} plan. Create your account to continue.`
    : "Create your UnyBase account.";

  return (
    <AuthShell title="Create your account" subtitle={subtitle}>
      <SignupForm plan={plan} />
    </AuthShell>
  );
}
