import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptCredential } from "@/lib/crypto";
import { runHealthCheck, expiryState, type IntegrationType } from "@/lib/integrations";
import { signupState } from "@/lib/subscriptionStatus";
import { sendNotification } from "@/lib/email";

// Nightly sweep. This is the piece that makes the rest of the
// system work unattended:
//
//   1. Re-checks every integration's health, so a credential that
//      dies at 3am is flagged by morning instead of at the next
//      time someone happens to click "Check all".
//   2. Emails the workspace owner when a credential is expiring
//      (14 / 7 / 1 days out) or has started failing.
//   3. Nudges people who signed up but never chose a plan, on days
//      1, 3 and 7, then stops.
//
// Auth: Vercel Cron sends CRON_SECRET as a bearer token. Without
// a matching secret the route refuses, so the endpoint being
// publicly routable does not make it publicly runnable.
//
// Every email goes through sendNotification with a dedupe key
// scoped to the thing and the day, so a retried or double-fired
// cron cannot spam anyone.

export const maxDuration = 300;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type IntegrationRow = {
  id: string;
  workspace_owner_id: string;
  name: string;
  integration_type: IntegrationType;
  credential_ciphertext: string | null;
  credential_iv: string | null;
  credential_tag: string | null;
  base_url: string | null;
  expires_at: string | null;
  health_status: string;
  account_identifier: string | null;
  account_ownership: string;
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "service_role_not_configured" }, { status: 500 });
  }

  const supabase = serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    integrations_checked: 0,
    health_alerts: 0,
    expiry_alerts: 0,
    signup_nudges: 0,
    errors: [] as string[],
  };

  // ---------------------------------------------------------------
  // 1 & 2. Integration health + expiry
  // ---------------------------------------------------------------
  try {
    const { data } = await supabase.from("integrations").select("*");
    const integrations = (data as IntegrationRow[] | null) ?? [];

    // Resolve owner emails once rather than per integration.
    const ownerIds = Array.from(new Set(integrations.map((i) => i.workspace_owner_id)));
    const ownerEmails = new Map<string, string>();
    for (const id of ownerIds) {
      const { data: em } = await supabase.rpc("email_for_user", { p_user: id });
      if (typeof em === "string") ownerEmails.set(id, em);
    }

    for (const row of integrations) {
      let credential: string | null = null;
      let decryptFailed = false;
      if (row.credential_ciphertext && row.credential_iv && row.credential_tag) {
        try {
          credential = decryptCredential({
            ciphertext: row.credential_ciphertext,
            iv: row.credential_iv,
            tag: row.credential_tag,
          });
        } catch {
          decryptFailed = true;
        }
      }

      const result = decryptFailed
        ? {
            status: "failed" as const,
            detail:
              "Stored credential could not be decrypted. The encryption key may have changed; re-enter the credential.",
          }
        : await runHealthCheck(row.integration_type, credential, row.base_url);

      const wasHealthy = row.health_status === "healthy";
      summary.integrations_checked += 1;

      await supabase
        .from("integrations")
        .update({
          health_status: result.status,
          health_detail: result.detail,
          last_health_check_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      await supabase.from("integration_events").insert({
        integration_id: row.id,
        actor_email: "scheduled-sweep",
        event_type:
          result.status === "healthy" ? "health_check_passed" : "health_check_failed",
        detail: result.detail,
      });

      const ownerEmail = ownerEmails.get(row.workspace_owner_id);
      if (!ownerEmail) continue;

      // Only alert on the transition into failure. Emailing every
      // night about a known-broken integration trains people to
      // ignore the alerts, which is worse than not sending them.
      if (result.status === "failed" && wasHealthy) {
        const r = await sendNotification({
          to: ownerEmail,
          toUserId: row.workspace_owner_id,
          template: "credential_failed",
          vars: { integrationName: row.name, detail: result.detail },
          dedupeKey: `credential_failed:${row.id}:${today}`,
        });
        if (r.status === "sent" || r.status === "skipped_no_provider")
          summary.health_alerts += 1;
      }

      // Expiry warnings at 14 / 7 / 1 days. Deduped on the exact
      // day count so each threshold fires once and only once.
      const exp = expiryState(row.expires_at);
      const d = exp.daysLeft;
      if (d !== null && [14, 7, 1].includes(d)) {
        const r = await sendNotification({
          to: ownerEmail,
          toUserId: row.workspace_owner_id,
          template: "credential_expiring",
          vars: {
            integrationName: row.name,
            whenPhrase: d === 1 ? "tomorrow" : `in ${d} days`,
            ...(row.account_identifier
              ? { accountIdentifier: row.account_identifier }
              : {}),
            ownership:
              row.account_ownership === "agency_master"
                ? "agency account"
                : "client account",
          },
          dedupeKey: `credential_expiring:${row.id}:${d}`,
        });
        if (r.status === "sent" || r.status === "skipped_no_provider")
          summary.expiry_alerts += 1;
      }
    }
  } catch (e) {
    summary.errors.push(
      `integrations: ${e instanceof Error ? e.message : "unknown"}`
    );
  }

  // ---------------------------------------------------------------
  // 3. Incomplete signup nudges
  // ---------------------------------------------------------------
  try {
    const { data } = await supabase
      .from("subscription_status")
      .select("*")
      .eq("subscription_state", "never_paid")
      .eq("billing_exempt", false)
      .is("plan_selected_at", null)
      .lt("nudge_count", 3);

    const rows = (data as Array<Record<string, unknown>> | null) ?? [];

    for (const row of rows) {
      const userId = row.user_id as string;
      const { data: createdAt } = await supabase.rpc("user_created_at", {
        p_user: userId,
      });
      const state = signupState({
        user_id: userId,
        last_payment_at: (row.last_payment_at as string | null) ?? null,
        last_payment_failed_at: (row.last_payment_failed_at as string | null) ?? null,
        subscription_state: row.subscription_state as string,
        automations_active: row.automations_active as boolean,
        cut_off_at: (row.cut_off_at as string | null) ?? null,
        billing_exempt: (row.billing_exempt as boolean | null) ?? false,
        intended_plan: (row.intended_plan as string | null) ?? null,
        plan_selected_at: (row.plan_selected_at as string | null) ?? null,
        created_at: typeof createdAt === "string" ? createdAt : null,
      });

      if (!state.incomplete || state.nudgeStep === null) continue;
      // Already sent this step or a later one.
      if ((row.nudge_count as number) >= state.nudgeStep) continue;

      const { data: email } = await supabase.rpc("email_for_user", { p_user: userId });
      if (typeof email !== "string") continue;

      const r = await sendNotification({
        to: email,
        toUserId: userId,
        template: "plan_not_selected",
        vars: { daysAgo: String(state.daysSinceSignup ?? "") },
        dedupeKey: `plan_not_selected:${userId}:step${state.nudgeStep}`,
      });

      if (r.status === "sent" || r.status === "skipped_no_provider") {
        await supabase
          .from("subscription_status")
          .update({
            nudge_count: state.nudgeStep,
            last_nudge_sent_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        summary.signup_nudges += 1;
      }
    }
  } catch (e) {
    summary.errors.push(`nudges: ${e instanceof Error ? e.message : "unknown"}`);
  }

  console.log("[sweep]", JSON.stringify(summary));
  return NextResponse.json({ ok: true, summary });
}
