import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendNotification } from "@/lib/email";
import { markPaid, markCancelled } from "@/lib/billing";
import { PAID_TAGS } from "@/lib/systeme";
import { inferPlanFromText } from "@/lib/plans";

// systeme.io webhook endpoint.
//
// Auth: shared secret in the ?token= query param, compared to
// SYSTEME_WEBHOOK_TOKEN. Query-param auth is fine here because
// systeme.io does not sign payloads with an HMAC — the token IS
// the auth, and HTTPS protects it in transit.
//
// Contract: always returns 200 unless the token is wrong. Even
// events we do not recognize get logged to subscription_events so
// we can inspect them later and expand the state model without
// losing history.
//
// State transitions we act on right now:
//   payment.succeeded, invoice.paid, subscription.renewed
//     -> mark active, clear last_payment_failed_at
//   payment.failed, invoice.failed
//     -> mark lapsed, set last_payment_failed_at (starts the
//        grace/warning/escalated/cutoff-recommended clock)
//   subscription.cancelled
//     -> mark cancelled
//
// Unknown event types are logged with processed=false so we can
// grep for them later and expand the switch.
//
// User matching: by customer_email. If we cannot match (event
// arrived before user signed up), user_id stays null on the events
// row and status is left untouched.
//
// This endpoint uses the Supabase service role via SRK if
// available, which bypasses RLS. If SRK is not set (early phase),
// it falls back to the anon key — inserts still work because we've
// added an insert policy for it below, but user matching won't
// find auth.users. Prefer SRK.

// Event names are normalised (lower-case, any separator -> ".") so
// "NEW_SALE", "new-sale" and "new.sale" all match. systeme.io sends
// different shapes depending on where the webhook is configured:
//   - automation rule "send webhook" after a sale: type
//     "customer.sale.completed", email at data.customer.email
//   - Settings > Webhooks: "New sale", "Sale canceled",
//     "Contact tag added", … (header X-Webhook-Event on some accounts)
const PAID_EVENTS = new Set([
  "payment.succeeded",
  "invoice.paid",
  "subscription.renewed",
  "subscription.payment.succeeded",
  "customer.sale.completed",
  "sale.completed",
  "new.sale",
  "sale.new",
  "order.completed",
  "order.paid",
]);
const FAILED_EVENTS = new Set([
  "payment.failed",
  "invoice.failed",
  "subscription.payment.failed",
  "sale.payment.failed",
  "customer.sale.failed",
]);
const CANCELLED_EVENTS = new Set([
  "subscription.cancelled",
  "subscription.canceled",
  "customer.subscription.deleted",
  "sale.canceled",
  "sale.cancelled",
  "customer.sale.canceled",
  "customer.sale.cancelled",
]);
const TAG_ADDED_EVENTS = new Set(["contact.tag.added", "tag.added", "customer.tag.added"]);

// Finds the price option name anywhere in the payload: any object
// under a key that looks like a price plan / offer with a "name".
// "UnyBase Premium - Yearly" is how plan and cycle reach us when both
// options live on the same order form.
function findPricePlanName(obj: unknown, depth = 0): string | null {
  if (!obj || typeof obj !== "object" || depth > 6) return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (/price.?plan|offer/i.test(k) && v && typeof v === "object") {
      const name = (v as Record<string, unknown>).name;
      if (typeof name === "string" && name.trim()) return name;
    }
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const hit = findPricePlanName(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

// Event name from any request header that carries one.
function eventFromHeaders(req: NextRequest): string | null {
  for (const [k, v] of req.headers.entries()) {
    if (/event/i.test(k) && v && !/^(text|application)\//.test(v)) return v;
  }
  return null;
}

function hasOrderData(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  const d = (o.data && typeof o.data === "object" ? o.data : {}) as Record<string, unknown>;
  return ["order", "order_item", "orderItem", "offer_price_plan", "pricePlan", "offerPricePlan"].some(
    (k) => k in o || k in d
  );
}

function normaliseEvent(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function pickString(obj: unknown, ...paths: string[][]): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const path of paths) {
    let cur: unknown = obj;
    let ok = true;
    for (const seg of path) {
      if (cur && typeof cur === "object" && seg in cur) {
        cur = (cur as Record<string, unknown>)[seg];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && typeof cur === "string" && cur.length > 0) return cur;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const expected = process.env.SYSTEME_WEBHOOK_TOKEN;
  const provided = req.nextUrl.searchParams.get("token");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawEvent =
    pickString(payload, ["type"], ["event"], ["event_type"], ["eventType"]) ??
    eventFromHeaders(req) ??
    pickString(payload, ["name"]) ??
    "unknown";
  let eventType = normaliseEvent(rawEvent);
  // Unlabelled payload that carries an order: a sale. Logged as such so
  // the raw payload in subscription_events shows how we read it.
  if (eventType === "unknown" && hasOrderData(payload)) eventType = "sale.completed";
  const customerEmail = pickString(
    payload,
    ["data", "customer", "email"],
    ["customer", "email"],
    ["data", "contact", "email"],
    ["contact", "email"],
    ["data", "email"],
    ["email"]
  );
  const tagName = pickString(payload, ["data", "tag", "name"], ["tag", "name"], ["data", "tag_name"]);
  const pricePlanName =
    findPricePlanName(payload) ?? pickString(payload, ["data", "funnel_step", "name"], ["funnel_step", "name"]);
  // "Contact tag added" with a paid tag counts as a payment: that is
  // what a systeme.io rule "New sale -> add tag unybase-customer" sends.
  const isPaidTag =
    TAG_ADDED_EVENTS.has(eventType) &&
    Boolean(tagName && PAID_TAGS.map((t) => t.toLowerCase()).includes(tagName.toLowerCase()));
  const customerId = pickString(
    payload,
    ["data", "customer", "id"],
    ["customer", "id"],
    ["data", "customer_id"]
  );
  const subscriptionId = pickString(
    payload,
    ["data", "subscription", "id"],
    ["subscription", "id"],
    ["data", "subscription_id"]
  );

  const supabase = getServiceClient();

  // Match user by email via RPC (service role can read auth.users;
  // RPC keeps the query narrow and lets us stay agnostic to schema
  // access levels).
  let userId: string | null = null;
  if (customerEmail) {
    const { data: matchedId } = await supabase.rpc(
      "find_user_id_by_email",
      { p_email: customerEmail.toLowerCase() }
    );
    if (typeof matchedId === "string") userId = matchedId;
  }

  const { error: insertError } = await supabase
    .from("subscription_events")
    .insert({
      user_id: userId,
      event_type: eventType,
      customer_email: customerEmail,
      systeme_customer_id: customerId,
      systeme_subscription_id: subscriptionId,
      payload: payload as object,
      processed: false,
    });
  if (insertError) {
    console.error("[systeme webhook] event log insert failed", insertError);
  }

  if (userId) {
    const now = new Date().toISOString();
    if (PAID_EVENTS.has(eventType) || isPaidTag) {
      const inferred = inferPlanFromText(pricePlanName);
      await markPaid(supabase, {
        userId,
        email: customerEmail,
        plan: inferred.plan,
        cycle: inferred.cycle,
        source: "webhook",
      });
    } else if (FAILED_EVENTS.has(eventType)) {
      await supabase
        .from("subscription_status")
        .update({
          subscription_state: "lapsed",
          last_payment_failed_at: now,
          updated_at: now,
        })
        .eq("user_id", userId);

      // Two emails on a failed payment, deliberately different:
      //   - the client gets an early, low-drama heads-up while
      //     nothing has actually been switched off yet
      //   - every admin gets an alert so they know to start the
      //     clock, because nothing here cuts off automatically
      //
      // Deduped per user per day: a retrying processor can fire
      // payment.failed repeatedly and the client should not get
      // five identical emails in an afternoon.
      // An exempt workspace has no billing relationship, so a
      // payment event that somehow names one is noise rather than
      // something to chase. Log it, skip the emails.
      const { data: exemptRow } = await supabase
        .from("subscription_status")
        .select("billing_exempt")
        .eq("user_id", userId)
        .maybeSingle();
      const isExempt = Boolean(
        (exemptRow as { billing_exempt: boolean } | null)?.billing_exempt
      );

      const day = now.slice(0, 10);
      if (customerEmail && !isExempt) {
        await sendNotification({
          to: customerEmail,
          toUserId: userId,
          template: "payment_failed_client",
          dedupeKey: `payment_failed_client:${userId}:${day}`,
          metadata: { eventType },
        });
      }
      const adminList = (process.env.SUPER_ADMIN_EMAILS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const adminEmail of isExempt ? [] : adminList) {
        await sendNotification({
          to: adminEmail,
          template: "payment_failed_admin",
          vars: { clientEmail: customerEmail ?? "unknown" },
          dedupeKey: `payment_failed_admin:${adminEmail}:${userId}:${day}`,
          metadata: { eventType },
        });
      }
    } else if (CANCELLED_EVENTS.has(eventType)) {
      await markCancelled(supabase, { userId, email: customerEmail });
    }
    if (
      PAID_EVENTS.has(eventType) ||
      isPaidTag ||
      FAILED_EVENTS.has(eventType) ||
      CANCELLED_EVENTS.has(eventType)
    ) {
      await supabase
        .from("subscription_events")
        .update({ processed: true })
        .eq("user_id", userId)
        .eq("event_type", eventType)
        .order("received_at", { ascending: false })
        .limit(1);
    }
  }

  return NextResponse.json({ ok: true, matched: userId !== null });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "systeme webhook" });
}
