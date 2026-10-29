import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link.">
      {error ? (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 8,
            background: "rgba(242,169,59,.1)",
            border: "1px solid rgba(242,169,59,.35)",
            fontSize: "0.88rem",
          }}
        >
          {error}
        </div>
      ) : null}
      <ForgotPasswordForm />
    </AuthShell>
  );
}
