import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthShell title="Log in" subtitle="Access your UnyBase workspace.">
      <LoginForm next={next} />
    </AuthShell>
  );
}
