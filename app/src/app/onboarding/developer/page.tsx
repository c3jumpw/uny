import { OnboardingShell } from "@/components/OnboardingShell";

export default function DeveloperOnboardingPage() {
  return (
    <OnboardingShell
      title="Set up as a developer"
      subtitle="We'll walk you through connecting your app to UnyBase."
    >
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span className="pill pill-warn">Coming back soon</span>
        </div>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          The developer onboarding walkthrough is being rebuilt. You&apos;ll get API keys,
          connection snippets, and a step-by-step guide to wiring your app to your UnyBase
          workspace.
        </p>
      </div>
    </OnboardingShell>
  );
}
