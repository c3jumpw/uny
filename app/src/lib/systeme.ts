import { serviceClient, hasServiceRole } from "@/lib/supabase/service";

// systeme.io Public API client — contact tags for segmenting.
//
// Two tags carry the funnel:
//   SYSTEME_SIGNUP_TAG    (default "unybase-signup")    added when an account is created
//   SYSTEME_CUSTOMER_TAG  (default "unybase-customer")  added when payment is confirmed
// The signup tag is also removed on payment, so the segments stay
// clean even before a systeme.io automation is set up to do it.
//
// SYSTEME_PAID_TAGS (comma list, default: the customer tag) are the
// tags that *prove* payment when we pull a contact. A systeme.io
// automation rule "New sale → add tag unybase-customer" makes the pull
// check work even when the webhook never fires.
//
// Endpoints (https://api.systeme.io/api, header X-API-Key):
//   GET    /contacts?email=…            find contact
//   POST   /contacts {email}            create contact
//   GET    /tags?query=…                find tag
//   POST   /tags {name}                 create tag
//   POST   /contacts/{id}/tags {tagId}  add tag
//   DELETE /contacts/{id}/tags/{tagId}  remove tag
// Official docs could not be fetched while building this, so the
// client is defensive: exact email matching, tolerant parsing, and
// every call is written to public.systeme_sync_log.
//
// With no SYSTEME_API_KEY set, every function is a logged no-op.

const BASE = (process.env.SYSTEME_API_BASE || "https://api.systeme.io/api").replace(/\/$/, "");

export const SIGNUP_TAG = process.env.SYSTEME_SIGNUP_TAG || "unybase-signup";
export const CUSTOMER_TAG = process.env.SYSTEME_CUSTOMER_TAG || "unybase-customer";
export const PAID_TAGS = (process.env.SYSTEME_PAID_TAGS || CUSTOMER_TAG)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function systemeConfigured(): boolean {
  return Boolean(process.env.SYSTEME_API_KEY);
}

type Tag = { id: number | string; name: string };
type Contact = { id: number | string; email: string; tags?: Tag[] };
type CallResult = { ok: boolean; status: number; json: unknown; text: string };

async function call(method: string, path: string, body?: unknown): Promise<CallResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "X-API-Key": process.env.SYSTEME_API_KEY!,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function log(entry: {
  userId?: string | null;
  email?: string | null;
  action: string;
  ok: boolean;
  statusCode?: number | null;
  detail?: string | null;
}) {
  if (!hasServiceRole()) return;
  try {
    await serviceClient()
      .from("systeme_sync_log")
      .insert({
        user_id: entry.userId ?? null,
        email: entry.email ?? null,
        action: entry.action,
        ok: entry.ok,
        status_code: entry.statusCode ?? null,
        detail: entry.detail ? entry.detail.slice(0, 500) : null,
      });
  } catch {
    // Logging must never break the caller.
  }
}

function items<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    for (const k of ["items", "data", "hydra:member", "results"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

async function findContact(email: string): Promise<Contact | null> {
  const r = await call("GET", `/contacts?email=${encodeURIComponent(email)}&limit=10`);
  if (!r.ok) throw new Error(`find contact ${r.status}: ${r.text.slice(0, 160)}`);
  const want = email.trim().toLowerCase();
  // Exact match only: a fuzzy search result must never get tagged.
  return items<Contact>(r.json).find((c) => c.email?.trim().toLowerCase() === want) ?? null;
}

async function findOrCreateContact(email: string): Promise<Contact> {
  const existing = await findContact(email);
  if (existing) return existing;
  const r = await call("POST", "/contacts", { email });
  if (!r.ok) {
    // Raced with a systeme.io opt-in that created it first.
    const again = await findContact(email);
    if (again) return again;
    throw new Error(`create contact ${r.status}: ${r.text.slice(0, 160)}`);
  }
  return r.json as Contact;
}

const tagCache = new Map<string, Tag>();

async function findOrCreateTag(name: string): Promise<Tag> {
  const key = name.toLowerCase();
  const cached = tagCache.get(key);
  if (cached) return cached;
  const r = await call("GET", `/tags?query=${encodeURIComponent(name)}&limit=100`);
  if (r.ok) {
    const hit = items<Tag>(r.json).find((t) => t.name?.toLowerCase() === key);
    if (hit) {
      tagCache.set(key, hit);
      return hit;
    }
  }
  const c = await call("POST", "/tags", { name });
  if (!c.ok) throw new Error(`create tag ${c.status}: ${c.text.slice(0, 160)}`);
  const tag = c.json as Tag;
  tagCache.set(key, tag);
  return tag;
}

export type TagOutcome = { ok: boolean; skipped?: boolean; detail?: string };

export async function addTag(
  email: string,
  tagName: string,
  userId?: string | null
): Promise<TagOutcome> {
  const action = `add_tag:${tagName}`;
  if (!systemeConfigured()) {
    await log({ userId, email, action, ok: false, detail: "skipped: SYSTEME_API_KEY not set" });
    return { ok: false, skipped: true, detail: "SYSTEME_API_KEY not set" };
  }
  try {
    const contact = await findOrCreateContact(email);
    if (contact.tags?.some((t) => t.name?.toLowerCase() === tagName.toLowerCase())) {
      await log({ userId, email, action, ok: true, detail: "already tagged" });
      return { ok: true };
    }
    const tag = await findOrCreateTag(tagName);
    const r = await call("POST", `/contacts/${contact.id}/tags`, { tagId: Number(tag.id) || tag.id });
    // 422 here usually means "already has this tag".
    const ok = r.ok || r.status === 422;
    await log({ userId, email, action, ok, statusCode: r.status, detail: r.ok ? null : r.text });
    return { ok, detail: r.ok ? undefined : r.text.slice(0, 200) };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    await log({ userId, email, action, ok: false, detail });
    return { ok: false, detail };
  }
}

export async function removeTag(
  email: string,
  tagName: string,
  userId?: string | null
): Promise<TagOutcome> {
  const action = `remove_tag:${tagName}`;
  if (!systemeConfigured()) return { ok: false, skipped: true };
  try {
    const contact = await findContact(email);
    const tag = contact?.tags?.find((t) => t.name?.toLowerCase() === tagName.toLowerCase());
    if (!contact || !tag) return { ok: true };
    const r = await call("DELETE", `/contacts/${contact.id}/tags/${tag.id}`);
    const ok = r.ok || r.status === 404;
    await log({ userId, email, action, ok, statusCode: r.status, detail: r.ok ? null : r.text });
    return { ok };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    await log({ userId, email, action, ok: false, detail });
    return { ok: false, detail };
  }
}

/**
 * Pull check: does this email's systeme.io contact carry a paid tag?
 * `checked` is false when we could not ask (no key, API error), so the
 * caller can say "we couldn't check" instead of "you haven't paid".
 */
export async function contactPaidTag(
  email: string,
  userId?: string | null
): Promise<{ checked: boolean; paid: boolean; tag?: string; detail?: string }> {
  if (!systemeConfigured()) return { checked: false, paid: false, detail: "not configured" };
  try {
    const contact = await findContact(email);
    if (!contact) {
      await log({ userId, email, action: "pull_check", ok: true, detail: "no contact" });
      return { checked: true, paid: false };
    }
    const wanted = PAID_TAGS.map((t) => t.toLowerCase());
    const hit = contact.tags?.find((t) => wanted.includes(t.name?.toLowerCase()));
    await log({
      userId,
      email,
      action: "pull_check",
      ok: true,
      detail: hit
        ? `paid tag: ${hit.name}`
        : `tags: ${(contact.tags ?? []).map((t) => t.name).join(", ") || "none"}`,
    });
    return { checked: true, paid: Boolean(hit), tag: hit?.name };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    await log({ userId, email, action: "pull_check", ok: false, detail });
    return { checked: false, paid: false, detail };
  }
}
