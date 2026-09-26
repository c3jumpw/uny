import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const PAID_EVENTS = new Set([
  "payment.succeeded",
  "invoice.paid",
  "subscription.renewed",
  "subscription.payment.succeeded",
]);
const FAILED_EVENTS = new Set([
  "payment.failed",
  "invoice.failed",
  "subscription.payment.failed",
]);
const CANCELLED_EVENTS = new Set([
  "subscription.cancelled",
  "subscription.canceled",
  "customer.subscription.deleted",
]);

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

  const eventType =
    pickString(payload, ["type"], ["event"], ["event_type"], ["name"]) ??
    "unknown";
  const customerEmail = pickString(
    payload,
    ["data", "customer", "email"],
    ["customer", "email"],
    ["data", "email"],
    ["email"]
  );
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
    if (PAID_EVENTS.has(eventType)) {
      await supabase
        .from("subscription_status")
        .update({
          subscription_state: "active",
          last_payment_at: now,
          last_payment_failed_at: null,
          updated_at: now,
        })
        .eq("user_id", userId);
    } else if (FAILED_EVENTS.has(eventType)) {
      await supabase
        .from("subscription_status")
        .update({
          subscription_state: "lapsed",
          last_payment_failed_at: now,
          updated_at: now,
        })
        .eq("user_id", userId);
    } else if (CANCELLED_EVENTS.has(eventType)) {
      await supabase
        .from("subscription_status")
        .update({
          subscription_state: "cancelled",
          updated_at: now,
        })
        .eq("user_id", userId);
    }
    if (
      PAID_EVENTS.has(eventType) ||
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
