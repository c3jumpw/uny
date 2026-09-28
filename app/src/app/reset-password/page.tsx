import { AuthShell } from "@/components/AuthShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password" subtitle="Almost done.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
