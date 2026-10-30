"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AccessReason } from "@/lib/subscriptionStatus";
import { formatPrice, yearlySaving, type Cycle, type Plan, type PlanId } from "@/lib/plans";

const SUPPORT = "support@unywebs.com";

export function PlansClient({
  email,
  plans,
  links,
  dedicatedYearly,
  defaultPlan,
  defaultCycle,
  reason,
  trialEndedOn,
}: {
  email: string;
  plans: Plan[];
  links: Record<PlanId, Record<Cycle, string>>;
  dedicatedYearly: Record<PlanId, boolean>;
  defaultPlan: PlanId;
  defaultCycle: Cycle;
  reason: AccessReason;
  trialEndedOn: string | null;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>(defaultCycle);
  const [selected, setSelected] = useState<PlanId>(defaultPlan);
  const [opened, setOpened] = useState<{ plan: PlanId; cycle: Cycle } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const polls = useRef(0);

  async function check(silent = false) {
    if (!silent) {
      setChecking(true);
      setCheckMsg(null);
    }
    try {
      const res = await fetch("/api/billing/check", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { paid?: boolean; message?: string };
      if (j.paid) {
        router.push("/dashboard?welcome=1");
        router.refresh();
        return;
      }
      if (!silent) setCheckMsg(j.message ?? "No payment confirmed yet.");
    } catch {
      if (!silent) setCheckMsg("Couldn't check just now. Try again in a moment.");
    } finally {
      if (!silent) setChecking(false);
    }
  }

  // After checkout opens, quietly re-check every 15s for ~3 minutes so
  // the page moves on by itself once payment confirms.
  useEffect(() => {
    if (!opened) return;
    polls.current = 0;
    const t = setInterval(() => {
      polls.current += 1;
      if (polls.current > 12) {
        clearInterval(t);
        return;
      }
      void check(true);
    }, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  function recordChoice(plan: PlanId) {
    setSelected(plan);
    setOpened({ plan, cycle });
    // keepalive so the request survives the tab switch to checkout.
    fetch("/api/billing/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, cycle }),
      keepalive: true,
    }).catch(() => {});
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const heading =
    reason === "trial"
      ? "Choose a plan before your trial ends"
      : reason === "trial_ended"
      ? "Your trial has ended — choose a plan to keep going"
      : reason === "cancelled"
        ? "Reactivate your workspace"
        : "Choose your plan to activate your workspace";
  const sub =
    reason === "trial"
      ? `You're on a trial${trialEndedOn ? ` until ${new Date(trialEndedOn).toLocaleDateString()}` : ""}. Paying now keeps everything running without a gap.`
      : reason === "trial_ended"
      ? `Your trial finished${trialEndedOn ? ` on ${new Date(trialEndedOn).toLocaleDateString()}` : ""}. Everything you added is still here — pick a plan to pick up where you left off.`
      : reason === "cancelled"
        ? "Your subscription was cancelled. Your data is still here; choose a plan to switch everything back on."
        : "Your account is ready. One last step: pick monthly or yearly billing and complete checkout.";

  return (
    <>
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "var(--ink)",
        }}
      >
        <div
          className="wrap"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: 12 }}
        >
          <Image src="/logo.png" alt="UnyBase" width={120} height={24} priority />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThemeToggle compact />
            <span style={{ color: "var(--paper-dim)", fontSize: "0.85rem" }}>
              {email}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={signOut}
              style={{ padding: "6px 14px", fontSize: "0.85rem" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="wrap" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 920 }}>
        {reason === "trial" ? (
          <p style={{ textAlign: "right", margin: "0 0 12px" }}>
            <a href="/dashboard" style={{ color: "var(--sky)", fontSize: "0.85rem" }}>
              ← Back to dashboard
            </a>
          </p>
        ) : null}
        {reason === "admin" ? (
          <div className="card" style={{ marginBottom: 20, fontSize: "0.85rem", color: "var(--paper-dim)" }}>
            Admin preview: this is what unpaid accounts see after logging in. Admin accounts are never gated.
          </div>
        ) : null}

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          {reason === "needs_plan" || reason === "admin" ? (
            <div style={{ color: "var(--amber)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: ".04em", marginBottom: 8 }}>
              STEP 4 OF 4
            </div>
          ) : null}
          <h1 style={{ margin: "0 0 8px", fontSize: "1.7rem", fontWeight: 600 }}>{heading}</h1>
          <p style={{ margin: "0 auto", color: "var(--paper-dim)", maxWidth: 600, lineHeight: 1.6 }}>{sub}</p>
        </div>

        <div
          role="radiogroup"
          aria-label="Billing cycle"
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              padding: 4,
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: "var(--surface)",
            }}
          >
            {(["monthly", "yearly"] as Cycle[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cycle === c}
                onClick={() => setCycle(c)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: 0,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: cycle === c ? "#1a1204" : "var(--paper-dim)",
                  background: cycle === c ? "var(--amber)" : "transparent",
                }}
              >
                {c === "monthly" ? "Monthly" : "Yearly"}
                {c === "yearly" ? (
                  <span style={{ marginLeft: 6, fontSize: "0.72rem", opacity: 0.85 }}>2 months free</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {plans.map((p) => {
            const isSel = selected === p.id;
            const price = cycle === "monthly" ? p.monthly : p.yearly;
            return (
              <div
                key={p.id}
                className="card"
                onClick={() => setSelected(p.id)}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  borderColor: isSel ? "var(--amber)" : undefined,
                  boxShadow: isSel ? "0 0 0 1px var(--amber)" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{p.name}</h2>
                  {p.id === "premium" ? <span className="pill pill-warn">For AI workspaces</span> : null}
                </div>
                <p style={{ margin: "0 0 14px", color: "var(--paper-dim)", fontSize: "0.88rem" }}>{p.tagline}</p>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: "1.9rem", fontWeight: 700 }}>{formatPrice(price)}</span>
                  <span style={{ color: "var(--paper-dim)" }}>{cycle === "monthly" ? " / month" : " / year"}</span>
                </div>
                <div style={{ color: "var(--paper-dim)", fontSize: "0.8rem", minHeight: 20, marginBottom: 14 }}>
                  {cycle === "yearly" ? (
                    <>
                      {formatPrice(p.yearly / 12)}/mo billed yearly ·{" "}
                      <span style={{ color: "var(--sky)", fontWeight: 600 }}>save {formatPrice(yearlySaving(p))}</span>
                    </>
                  ) : (
                    <>or {formatPrice(p.yearly)}/year and save {formatPrice(yearlySaving(p))}</>
                  )}
                </div>
                <ul style={{ margin: "0 0 18px", paddingLeft: 18, listStyle: "disc", color: "var(--paper-dim)", fontSize: "0.86rem", lineHeight: 1.7, flex: 1 }}>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a
                  href={links[p.id][cycle]}
                  target="_blank"
                  rel="noopener"
                  className={isSel ? "btn btn-amber" : "btn btn-ghost"}
                  onClick={(e) => {
                    e.stopPropagation();
                    recordChoice(p.id);
                  }}
                  style={{ textAlign: "center", width: "100%" }}
                >
                  Continue to checkout — {p.name} {cycle === "yearly" ? "yearly" : "monthly"}
                </a>
                {!(cycle === "yearly" && dedicatedYearly[p.id]) ? (
                  // Monthly and yearly share one order form, so name the
                  // exact option to tick there.
                  <small style={{ display: "block", marginTop: 8, color: "var(--muted)", fontSize: "0.75rem", textAlign: "center" }}>
                    On the checkout page, select{" "}
                    <strong style={{ color: "var(--paper-dim)" }}>
                      UnyBase {p.name} - {cycle === "yearly" ? "Yearly" : "Monthly"}
                    </strong>
                    .
                  </small>
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          className="card"
          style={{
            borderColor: opened ? "rgba(90,169,230,.45)" : undefined,
            background: opened ? "rgba(90,169,230,.06)" : undefined,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {opened ? "Checkout is open in a new tab" : "How checkout works"}
          </div>
          <ol style={{ margin: "0 0 14px", paddingLeft: 18, listStyle: "decimal", color: "var(--paper-dim)", fontSize: "0.88rem", lineHeight: 1.7 }}>
            <li>
              Pay using <strong style={{ color: "var(--paper)" }}>{email}</strong> &mdash; the same email as this account,
              so we can match the payment to you.
            </li>
            <li>Come back to this tab. It checks for your payment automatically for a few minutes.</li>
            <li>Your dashboard opens as soon as the payment is confirmed, and we email you a confirmation.</li>
          </ol>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={() => check(false)} disabled={checking}>
              {checking ? "Checking…" : "I've already paid — check now"}
            </button>
            {checkMsg ? (
              <span role="status" style={{ fontSize: "0.85rem", color: "var(--paper-dim)" }}>
                {checkMsg}
              </span>
            ) : null}
          </div>
          <p style={{ margin: "14px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
            Paid with a different email, or stuck? Write to{" "}
            <a href={`mailto:${SUPPORT}`} style={{ color: "var(--sky)" }}>
              {SUPPORT}
            </a>{" "}
            and we&apos;ll link it to your account.
          </p>
        </div>
      </main>
    </>
  );
}
