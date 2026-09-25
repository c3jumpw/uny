import { AuthShell } from "@/components/AuthShell";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params; // token unused until team system is rebuilt
  return (
    <AuthShell
      title="Invitation received"
      subtitle="This invitation is being processed. The team system is being rebuilt — please check back shortly."
    >
      <p style={{ margin: 0, color: "var(--paper-dim)", fontSize: "0.9rem" }}>
        If you already have an account, log in and your invitation will be applied automatically
        once the team system is back online.
      </p>
    </AuthShell>
  );
}
