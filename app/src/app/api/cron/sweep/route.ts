import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptCredential } from "@/lib/crypto";
import {
  runHealthCheck,
  expiryState,
  type IntegrationType,
  type AuthScheme,
} from "@/lib/integrations";
import { sendNotification } from "@/lib/email";

// Nightly sweep. This is the piece that makes the rest of the
// system work unattended:
//
//   1. Re-checks every integration's health, so a credential that
//      dies at 3am is flagged by morning instead of at the next
//      time someone happens to click "Check all".
//   2. Emails the workspace owner when a credential is expiring
//      (14 / 7 / 1 days out) or has started failing.
//   3. Reminds people who created an account but never paid, on days
//      1, 3 and 7, then stops (plan chosen -> "finish checkout",
//      otherwise "choose a plan").
//   4. Re-sends one confirmation link to signups still unconfirmed
//      after a day.
//   5. Manual trials: reminders to the prospect, alerts to admins.
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
  auth_scheme: AuthScheme | null;
  auth_param_name: string | null;
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
    domain_alerts: 0,
    signup_nudges: 0,
    confirm_reminders: 0,
    trial_alerts: 0,
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
        : await runHealthCheck(row.integration_type, credential, row.base_url, {
            scheme: row.auth_scheme ?? "bearer",
            paramName: row.auth_param_name,
          });

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
  // 2b. Domain and SSL renewal warnings
  //
  // Wider thresholds than credentials (30 days as well as 14/7/1):
  // a domain transfer or a disputed renewal can take weeks, and
  // unlike a token you cannot simply regenerate one in a hurry.
  // ---------------------------------------------------------------
  try {
    const { data } = await supabase.from("domains").select("*");
    const rows =
      (data as Array<Record<string, unknown>> | null) ?? [];

    const ownerCache = new Map<string, string>();
    for (const row of rows) {
      const ownerId = row.workspace_owner_id as string;
      if (!ownerCache.has(ownerId)) {
        const { data: em } = await supabase.rpc("email_for_user", { p_user: ownerId });
        if (typeof em === "string") ownerCache.set(ownerId, em);
      }
      const ownerEmail = ownerCache.get(ownerId);
      if (!ownerEmail) continue;

      const checks: Array<{ at: string | null; isSsl: boolean }> = [
        { at: (row.expires_at as string | null) ?? null, isSsl: false },
        { at: (row.ssl_expires_at as string | null) ?? null, isSsl: true },
      ];

      for (const c of checks) {
        if (!c.at) continue;
        const d = expiryState(c.at).daysLeft;
        if (d === null || ![30, 14, 7, 1].includes(d)) continue;

        const r = await sendNotification({
          to: ownerEmail,
          toUserId: ownerId,
          template: "domain_expiring",
          vars: {
            domainName: (row.domain_name as string) ?? "a domain",
            whatExpires: c.isSsl ? "An SSL certificate" : "A domain",
            isSsl: String(c.isSsl),
            whenPhrase: d === 1 ? "tomorrow" : `in ${d} days`,
            autoRenew: String(Boolean(row.auto_renew)),
            ...(row.registrar ? { registrar: row.registrar as string } : {}),
            ...(row.registrar_account
              ? { registrarAccount: row.registrar_account as string }
              : {}),
          },
          dedupeKey: `domain_expiring:${row.id as string}:${c.isSsl ? "ssl" : "domain"}:${d}`,
        });
        if (r.status === "sent" || r.status === "skipped_no_provider")
          summary.domain_alerts += 1;
      }
    }
  } catch (e) {
    summary.errors.push(`domains: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ---------------------------------------------------------------
  // 3. Unpaid-account reminders (days 1, 3 and 7, then stop)
  //
  // Everyone who created an account but never paid gets the same
  // three-step sequence. If they already chose a plan the email talks
  // about finishing checkout; if not, about choosing one. Both send
  // them to log in, which lands on the plan picker. Unconfirmed
  // accounts are skipped (they can't log in yet — step 4 covers them),
  // as are exempt accounts and anyone on a manual trial.
  // ---------------------------------------------------------------
  try {
    const { data } = await supabase
      .from("subscription_status")
      .select("*")
      .eq("subscription_state", "never_paid")
      .eq("billing_exempt", false)
      .is("trial_ends_at", null)
      .is("last_payment_at", null)
      .lt("nudge_count", 3);

    const rows = (data as Array<Record<string, unknown>> | null) ?? [];

    for (const row of rows) {
      const userId = row.user_id as string;

      const { data: summaryRows, error: summaryErr } = await supabase.rpc("auth_user_summary", {
        p_user: userId,
      });
      let createdAt: string | null = null;
      let email: string | null = null;
      let confirmed = true;
      const info = Array.isArray(summaryRows) ? summaryRows[0] : null;
      if (!summaryErr && info) {
        createdAt = info.created_at ?? null;
        email = info.email ?? null;
        confirmed = Boolean(info.email_confirmed_at);
      } else {
        // Before the phase 10 migration: fall back to the older RPCs.
        const [{ data: c }, { data: e }] = await Promise.all([
          supabase.rpc("user_created_at", { p_user: userId }),
          supabase.rpc("email_for_user", { p_user: userId }),
        ]);
        createdAt = typeof c === "string" ? c : null;
        email = typeof e === "string" ? e : null;
      }
      if (!email || !createdAt || !confirmed) continue;

      const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
      // Accounts older than two weeks predate this sequence or have
      // gone cold; a first-ever "last reminder" would just be noise.
      if (days > 14) continue;
      const step = days >= 7 ? 3 : days >= 3 ? 2 : days >= 1 ? 1 : null;
      if (step === null || (row.nudge_count as number) >= step) continue;

      const plan = (row.intended_plan as string | null) ?? null;
      const cycle = (row.intended_cycle as string | null) ?? null;
      const r = await sendNotification({
        to: email,
        toUserId: userId,
        template: plan ? "finish_checkout" : "plan_not_selected",
        vars: {
          daysAgo: String(days),
          step: String(step),
          ...(plan ? { planName: plan === "premium" ? "Premium" : "Basic" } : {}),
          ...(cycle ? { cycleLabel: cycle === "yearly" ? "billed yearly" : "billed monthly" } : {}),
        },
        dedupeKey: `unpaid_reminder:${userId}:step${step}`,
      });

      if (r.status === "sent" || r.status === "skipped_no_provider" || r.status === "duplicate") {
        await supabase
          .from("subscription_status")
          .update({ nudge_count: step, last_nudge_sent_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (r.status !== "duplicate") summary.signup_nudges += 1;
      }
    }
  } catch (e) {
    summary.errors.push(`nudges: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ---------------------------------------------------------------
  // 4. Unconfirmed signups: one fresh confirmation link after a day
  //
  // The original link may have been missed, filtered or expired. One
  // re-send between 24 and 72 hours, via Supabase so the link is real.
  // ---------------------------------------------------------------
  try {
    const { data: pending, error: pendErr } = await supabase.rpc("unconfirmed_signups", {
      p_min_age: "24 hours",
      p_max_age: "72 hours",
    });
    if (!pendErr) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://unybase.unywebs.com";
      for (const u of (pending as Array<{ user_id: string; email: string }> | null) ?? []) {
        // Claim first so a double-fired cron can't resend.
        const { error: claimErr } = await supabase.from("notifications").insert({
          recipient_email: u.email,
          recipient_user_id: u.user_id,
          template: "confirm_reminder",
          subject: "Confirm your UnyBase email (resent)",
          dedupe_key: `confirm_reminder:${u.user_id}`,
          status: "pending",
        });
        if (claimErr) continue;
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: u.email,
          options: { emailRedirectTo: `${appUrl}/auth/callback?flow=signup` },
        });
        await supabase
          .from("notifications")
          .update(
            error
              ? { status: "failed", error: error.message.slice(0, 500) }
              : { status: "sent", sent_at: new Date().toISOString(), provider_id: "supabase-auth" }
          )
          .eq("dedupe_key", `confirm_reminder:${u.user_id}`);
        if (!error) summary.confirm_reminders += 1;
      }
    }
  } catch (e) {
    summary.errors.push(`confirm: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ---------------------------------------------------------------
  // 5. Manual trials
  //
  //   prospect: reminders 3 days and 1 day before, and once when it ends
  //   super admins: alerts at 7, 3 and 1 days
  // Nothing is switched off when a trial ends; the prospect simply sees
  // the plan picker at their next login.
  // ---------------------------------------------------------------
  try {
    const { data } = await supabase
      .from("subscription_status")
      .select("user_id, trial_ends_at, trial_note, trial_converted_at, subscription_state")
      .not("trial_ends_at", "is", null)
      .is("trial_converted_at", null)
      .neq("subscription_state", "active");
    const admins = (process.env.SUPER_ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    for (const row of (data as Array<Record<string, string | null>> | null) ?? []) {
      const userId = row.user_id as string;
      const endsAt = row.trial_ends_at as string;
      const msLeft = new Date(endsAt).getTime() - Date.now();
      const daysLeft = Math.ceil(msLeft / 86_400_000);
      const endsOn = new Date(endsAt).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
      const { data: em } = await supabase.rpc("email_for_user", { p_user: userId });
      const email = typeof em === "string" ? em : null;
      if (!email) continue;
      const whenPhrase = daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} days`;

      if (msLeft > 0 && [3, 1].includes(daysLeft)) {
        const r = await sendNotification({
          to: email,
          toUserId: userId,
          template: "trial_ending_client",
          vars: { endsOn, whenPhrase },
          dedupeKey: `trial_ending_client:${userId}:${endsAt.slice(0, 10)}:${daysLeft}`,
        });
        if (r.status === "sent" || r.status === "skipped_no_provider") summary.trial_alerts += 1;
      }
      if (msLeft > 0 && [7, 3, 1].includes(daysLeft)) {
        for (const a of admins) {
          const r = await sendNotification({
            to: a,
            template: "trial_ending_soon",
            vars: { clientEmail: email, endsOn, whenPhrase, ...(row.trial_note ? { note: row.trial_note } : {}) },
            dedupeKey: `trial_ending:${a}:${userId}:${endsAt.slice(0, 10)}:${daysLeft}`,
          });
          if (r.status === "sent" || r.status === "skipped_no_provider") summary.trial_alerts += 1;
        }
      }
      // Ended within the last 3 days: tell them once.
      if (msLeft <= 0 && msLeft > -3 * 86_400_000) {
        const r = await sendNotification({
          to: email,
          toUserId: userId,
          template: "trial_ended_client",
          vars: { endsOn },
          dedupeKey: `trial_ended_client:${userId}:${endsAt.slice(0, 10)}`,
        });
        if (r.status === "sent" || r.status === "skipped_no_provider") summary.trial_alerts += 1;
      }
    }
  } catch (e) {
    summary.errors.push(`trials: ${e instanceof Error ? e.message : "unknown"}`);
  }

  console.log("[sweep]", JSON.stringify(summary));
  return NextResponse.json({ ok: true, summary });
}
