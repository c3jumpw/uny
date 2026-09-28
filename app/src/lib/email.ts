import { createClient } from "@supabase/supabase-js";

// Outbound email.
//
// Provider: Resend over plain fetch — no SDK dependency, since one
// POST is the whole integration surface.
//
// Every send is recorded in public.notifications BEFORE the provider
// call, with a unique dedupe_key. That gives us two things:
//
//  1. An audit trail. "Did we actually warn the client before we cut
//     them off?" is answerable from the database, not from memory.
//  2. Idempotency. The scheduled sweep can run twice (cron retries,
//     overlapping invocations) without double-sending, because the
//     second insert collides on dedupe_key and we bail.
//
// If RESEND_API_KEY is not set the send is recorded as
// 'skipped_no_provider' rather than failing. The app stays fully
// functional without email configured; you just get a queue you can
// inspect later.

const FROM = process.env.EMAIL_FROM || "UnyBase <noreply@unywebs.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://unybase.unywebs.com";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@unywebs.com";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// ---------------------------------------------------------------
// Branded shell
// ---------------------------------------------------------------

function shell(opts: {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const { heading, body, ctaLabel, ctaUrl, footerNote } = opts;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1220;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0e1829;border:1px solid #1e2b40;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 0;">
          <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em;">
            <span style="color:#e8eef7;">uny</span><span style="color:#5aa9e6;">base</span>
          </div>
        </td></tr>
        <tr><td style="padding:20px 32px 0;">
          <h1 style="margin:0 0 12px;color:#e8eef7;font-size:20px;font-weight:600;line-height:1.3;">${heading}</h1>
          <div style="color:#9fb0c7;font-size:15px;line-height:1.6;">${body}</div>
        </td></tr>
        ${
          ctaLabel && ctaUrl
            ? `<tr><td style="padding:24px 32px 0;">
                 <a href="${ctaUrl}" style="display:inline-block;background:#f2a93b;color:#1a1204;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;">${ctaLabel}</a>
               </td></tr>`
            : ""
        }
        <tr><td style="padding:28px 32px 28px;">
          <div style="border-top:1px solid #1e2b40;padding-top:16px;color:#6b7d94;font-size:13px;line-height:1.5;">
            ${footerNote ? `${footerNote}<br><br>` : ""}
            Questions? Reply to this email, or write to
            <a href="mailto:${SUPPORT_EMAIL}" style="color:#5aa9e6;text-decoration:none;">${SUPPORT_EMAIL}</a>
            &mdash; both reach the same place.
          </div>
        </td></tr>
      </table>
      <div style="max-width:560px;margin:16px auto 0;color:#4a5a70;font-size:12px;text-align:center;">
        UnyBase &mdash; managed backend for web and mobile apps
      </div>
    </td></tr>
  </table>
</body></html>`;
}

// ---------------------------------------------------------------
// Templates
// ---------------------------------------------------------------

export type TemplateName =
  | "welcome"
  | "plan_not_selected"
  | "payment_failed_client"
  | "payment_failed_admin"
  | "cutoff"
  | "restore"
  | "credential_expiring"
  | "credential_failed"
  | "imported_client"
  | "grant_granted"
  | "grant_revoked"
  | "vault_shared";

type Built = { subject: string; html: string };

export function buildTemplate(
  name: TemplateName,
  vars: Record<string, string>
): Built {
  switch (name) {
    case "welcome":
      return {
        subject: "Welcome to UnyBase",
        html: shell({
          heading: "Your UnyBase account is ready",
          body: `<p style="margin:0 0 12px;">Thanks for signing up. Your workspace is live and you can sign in any time.</p>
                 <p style="margin:0;">We'll be in touch shortly to help you connect your first app. If you'd rather get moving now, your dashboard has everything you need to start, and ${SUPPORT_EMAIL} reaches us any time.</p>`,
          ctaLabel: "Open your dashboard",
          ctaUrl: `${APP_URL}/dashboard`,
        }),
      };

    case "plan_not_selected":
      return {
        subject: "Finish setting up your UnyBase workspace",
        html: shell({
          heading: "You're one step away",
          body: `<p style="margin:0 0 12px;">You created a UnyBase account${
            vars.daysAgo ? ` ${vars.daysAgo} days ago` : ""
          } but haven't chosen a plan yet, so your workspace isn't active.</p>
                 <p style="margin:0;">Picking a plan takes about a minute and activates everything straight away.</p>`,
          ctaLabel: "Choose your plan",
          ctaUrl: `${APP_URL}/start`,
          footerNote:
            "Not ready yet? No problem — your account stays put and nothing expires.",
        }),
      };

    case "payment_failed_client":
      return {
        subject: "We couldn't process your UnyBase payment",
        html: shell({
          heading: "Your last payment didn't go through",
          body: `<p style="margin:0 0 12px;">We tried to process your UnyBase subscription and the payment was declined.</p>
                 <p style="margin:0 0 12px;">Nothing has changed on your account yet &mdash; your workspace and integrations are still running. We wanted to flag it early so you have time to sort it out.</p>
                 <p style="margin:0;">Updating your payment method usually resolves it immediately.</p>`,
          ctaLabel: "Update payment details",
          ctaUrl: vars.billingUrl || `${APP_URL}/dashboard`,
          footerNote:
            `If you think this is a mistake, email ${SUPPORT_EMAIL} and a human will look into it.`,
        }),
      };

    case "payment_failed_admin":
      return {
        subject: `Payment failed: ${vars.clientEmail ?? "a client"}`,
        html: shell({
          heading: "A client payment failed",
          body: `<p style="margin:0 0 12px;"><strong style="color:#e8eef7;">${
            vars.clientEmail ?? "Unknown"
          }</strong> had a payment decline.</p>
                 <p style="margin:0 0 12px;">Their account is now marked <strong style="color:#e8eef7;">lapsed</strong>. Automations are still running &mdash; nothing was cut off automatically.</p>
                 <p style="margin:0;">The admin dashboard tracks how long they've been lapsed and will flag when a cutoff is worth considering.</p>`,
          ctaLabel: "Open admin dashboard",
          ctaUrl: `${APP_URL}/admin`,
        }),
      };

    case "cutoff":
      return {
        subject: "Your UnyBase automations have been paused",
        html: shell({
          heading: "Your automations are paused",
          body: `<p style="margin:0 0 12px;">We've paused the automations on your UnyBase workspace and your API key has been deactivated.</p>
                 <p style="margin:0 0 12px;">This is because your subscription payment hasn't gone through${
                   vars.daysLapsed
                     ? ` for ${vars.daysLapsed} days`
                     : ""
                 }.</p>
                 ${
                   vars.reason
                     ? `<p style="margin:0 0 12px;padding:12px 14px;background:#131f33;border-left:3px solid #f2a93b;border-radius:4px;color:#c8d6e8;"><strong style="color:#e8eef7;">Note:</strong> ${vars.reason}</p>`
                     : ""
                 }
                 <p style="margin:0;">Your data is safe and nothing has been deleted. Once payment is resolved we'll restore everything &mdash; your existing API key will start working again, so you won't need to change any code.</p>`,
          ctaLabel: "Resolve payment",
          ctaUrl: vars.billingUrl || `${APP_URL}/dashboard`,
          footerNote: `If you believe this was done in error, email ${SUPPORT_EMAIL} and we'll restore your access right away.`,
        }),
      };

    case "restore":
      return {
        subject: "Your UnyBase automations are back on",
        html: shell({
          heading: "You're back up and running",
          body: `<p style="margin:0 0 12px;">Your UnyBase automations have been restored and your API key is active again.</p>
                 <p style="margin:0;">Your original key was reactivated rather than replaced, so any integrations you already have in place will pick straight back up. No code changes needed.</p>`,
          ctaLabel: "Open your dashboard",
          ctaUrl: `${APP_URL}/dashboard`,
          footerNote: "Thanks for sorting that out.",
        }),
      };

    case "credential_expiring":
      return {
        subject: `Credential expiring: ${vars.integrationName ?? "an integration"}`,
        html: shell({
          heading: "A credential is about to expire",
          body: `<p style="margin:0 0 12px;"><strong style="color:#e8eef7;">${
            vars.integrationName ?? "An integration"
          }</strong> expires ${vars.whenPhrase ?? "soon"}.</p>
                 ${
                   vars.accountIdentifier
                     ? `<p style="margin:0 0 12px;">Account: <strong style="color:#e8eef7;">${vars.accountIdentifier}</strong>${
                         vars.ownership
                           ? ` (${vars.ownership})`
                           : ""
                       }</p>`
                     : ""
                 }
                 <p style="margin:0;">Rotating it before the deadline avoids the silent breakage that happens when a token dies mid-deploy.</p>`,
          ctaLabel: "Open the vault",
          ctaUrl: `${APP_URL}/dashboard/vault`,
        }),
      };

    case "credential_failed":
      return {
        subject: `Integration check failed: ${vars.integrationName ?? "an integration"}`,
        html: shell({
          heading: "An integration stopped responding",
          body: `<p style="margin:0 0 12px;">Our scheduled check on <strong style="color:#e8eef7;">${
            vars.integrationName ?? "an integration"
          }</strong> failed.</p>
                 ${
                   vars.detail
                     ? `<p style="margin:0 0 12px;padding:12px 14px;background:#131f33;border-left:3px solid #ff8080;border-radius:4px;color:#c8d6e8;font-family:ui-monospace,Menlo,monospace;font-size:13px;">${vars.detail}</p>`
                     : ""
                 }
                 <p style="margin:0;">If the credential was revoked or rotated on the provider's side, updating it in the vault will clear this.</p>`,
          ctaLabel: "Open the vault",
          ctaUrl: `${APP_URL}/dashboard/vault`,
        }),
      };

    case "imported_client":
      return {
        subject: "Your UnyBase account is ready",
        html: shell({
          heading: "We've set up your UnyBase account",
          body: `<p style="margin:0 0 12px;">Your UnyBase workspace is live and linked to your existing subscription &mdash; there's nothing to pay and nothing to re-enter.</p>
                 <p style="margin:0;">Set a password using the button below and you're in.</p>`,
          ctaLabel: "Set your password",
          ctaUrl: vars.setPasswordUrl || `${APP_URL}/login`,
          footerNote:
            "This link is single-use. If it's expired by the time you click it, use the 'forgot password' option on the login page.",
        }),
      };

    case "grant_granted":
      return {
        subject: `You've been granted access to a UnyBase workspace`,
        html: shell({
          heading: "New workspace access",
          body: `<p style="margin:0 0 12px;"><strong style="color:#e8eef7;">${
            vars.ownerEmail ?? "A client"
          }</strong> has granted you technical admin access to their UnyBase workspace.</p>
                 ${
                   vars.expiresPhrase
                     ? `<p style="margin:0 0 12px;">This access ${vars.expiresPhrase}.</p>`
                     : ""
                 }
                 <p style="margin:0;">You can now see their subscription status and integrations from the admin dashboard.</p>`,
          ctaLabel: "Open admin dashboard",
          ctaUrl: `${APP_URL}/admin`,
        }),
      };

    case "vault_shared":
      return {
        subject: `${vars.ownerEmail ?? "A UnyBase workspace"} shared credentials with you`,
        html: shell({
          heading: "Credentials shared with you",
          body: `<p style="margin:0 0 12px;"><strong style="color:#e8eef7;">${
            vars.ownerEmail ?? "A UnyBase workspace"
          }</strong> has given you access to ${
            vars.scopeLabel ?? "some credentials"
          } in their UnyBase vault.</p>
                 ${
                   vars.expiresPhrase
                     ? `<p style="margin:0 0 12px;">${vars.expiresPhrase}</p>`
                     : ""
                 }
                 <p style="margin:0;">Sign in to view them. If you don't have a UnyBase account yet, create one with this email address and the shared credentials will be waiting.</p>`,
          ctaLabel: "Open the vault",
          ctaUrl: `${APP_URL}/dashboard/vault`,
        }),
      };

    case "grant_revoked":
      return {
        subject: "Workspace access revoked",
        html: shell({
          heading: "Access revoked",
          body: `<p style="margin:0;"><strong style="color:#e8eef7;">${
            vars.ownerEmail ?? "A client"
          }</strong> has revoked your technical admin access to their UnyBase workspace. You can no longer see their data.</p>`,
        }),
      };
  }
}

// ---------------------------------------------------------------
// Sender
// ---------------------------------------------------------------

export type SendResult = {
  ok: boolean;
  status: "sent" | "failed" | "skipped_no_provider" | "duplicate";
  detail?: string;
};

export async function sendNotification(opts: {
  to: string;
  toUserId?: string | null;
  template: TemplateName;
  vars?: Record<string, string>;
  /** Supply to make the send idempotent. Same key never sends twice. */
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<SendResult> {
  const { to, toUserId, template, vars = {}, dedupeKey, metadata } = opts;
  const built = buildTemplate(template, vars);
  const supabase = serviceClient();

  // Claim the send first. If dedupeKey collides, someone already did it.
  const { data: row, error: claimError } = await supabase
    .from("notifications")
    .insert({
      recipient_email: to,
      recipient_user_id: toUserId ?? null,
      template,
      subject: built.subject,
      dedupe_key: dedupeKey ?? null,
      status: "pending",
      metadata: metadata ?? null,
    })
    .select("id")
    .single();

  if (claimError) {
    // 23505 = unique_violation on dedupe_key: already handled.
    if (claimError.code === "23505") {
      return { ok: true, status: "duplicate" };
    }
    console.error("[email] could not record notification", claimError);
    return { ok: false, status: "failed", detail: claimError.message };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await supabase
      .from("notifications")
      .update({ status: "skipped_no_provider" })
      .eq("id", row.id);
    console.log(
      `[email] no RESEND_API_KEY set — queued "${built.subject}" for ${to} without sending`
    );
    return { ok: true, status: "skipped_no_provider" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        // Sends come from a noreply address on the verified domain,
        // but several templates invite a reply ("reply and we'll
        // restore your access"). Without this header those replies
        // would land in an unmonitored mailbox, which is worse than
        // not offering to help at all.
        reply_to: SUPPORT_EMAIL,
        subject: built.subject,
        html: built.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `${res.status}`);
      await supabase
        .from("notifications")
        .update({ status: "failed", error: errText.slice(0, 500) })
        .eq("id", row.id);
      return { ok: false, status: "failed", detail: errText.slice(0, 200) };
    }

    const body = (await res.json().catch(() => ({}))) as { id?: string };
    await supabase
      .from("notifications")
      .update({
        status: "sent",
        provider_id: body.id ?? null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return { ok: true, status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await supabase
      .from("notifications")
      .update({ status: "failed", error: msg.slice(0, 500) })
      .eq("id", row.id);
    return { ok: false, status: "failed", detail: msg };
  }
}
