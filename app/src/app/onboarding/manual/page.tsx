import { OnboardingShell } from "@/components/OnboardingShell";

export default function ManualOnboardingPage() {
  return (
    <OnboardingShell
      title="Get set up"
      subtitle="We'll help you set up your workspace step by step."
    >
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span className="pill pill-warn">Coming back soon</span>
        </div>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          The guided setup flow is being rebuilt. It will take you through connecting your
          domain, adding teammates, and configuring your first integrations.
        </p>
      </div>
    </OnboardingShell>
  );
}
