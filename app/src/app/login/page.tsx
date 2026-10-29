import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    confirmed?: string;
    error?: string;
    error_code?: string;
    plan?: string;
    reset?: string;
  }>;
}) {
  const { next, confirmed, error, error_code, plan, reset } = await searchParams;

  const title = confirmed ? "Email confirmed" : "Log in";
  const subtitle = confirmed
    ? "Log in with the password you chose, then pick your plan."
    : "Access your UnyBase workspace.";

  return (
    <AuthShell title={title} subtitle={subtitle}>
      <LoginForm
        next={next}
        confirmed={Boolean(confirmed)}
        reset={Boolean(reset)}
        linkError={error ?? null}
        linkErrorCode={error_code ?? null}
        plan={plan}
      />
    </AuthShell>
  );
}
