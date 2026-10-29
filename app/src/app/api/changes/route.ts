import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Change requests: notes on edits wanted in an app or tool, tracked
// from "logged" through "sent to the developer" to "done".
//
// All access goes through the signed-in user's client, so RLS decides
// what each person can read and write (owner, super admin, granted
// technical admins, and anyone the vault is shared with for that
// system). Deleting is limited by RLS to owner / admins.

const KINDS = new Set(["fix", "change", "new"]);
const PRIORITIES = new Set(["low", "normal", "high"]);
const STATUSES = new Set(["pending", "sent", "done", "dropped"]);

function cleanSystem(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items: unknown[] = Array.isArray(body?.items) ? body.items : [];
  const owner = typeof body?.workspace_owner_id === "string" ? body.workspace_owner_id : user.id;
  const system = cleanSystem(body?.associated_system);
  const kind = KINDS.has(body?.kind) ? body.kind : "change";
  const priority = PRIORITIES.has(body?.priority) ? body.priority : "normal";

  const rows = items
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean)
    .slice(0, 200)
    .map((text) => ({
      workspace_owner_id: owner,
      created_by: user.id,
      created_by_email: user.email ?? null,
      body: text.slice(0, 4000),
      associated_system: system,
      kind,
      priority,
    }));
  if (rows.length === 0) return NextResponse.json({ error: "Nothing to add." }, { status: 400 });

  const { data, error } = await supabase.from("change_requests").insert(rows).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {};
  if (typeof body.body === "string") {
    if (!body.body.trim()) return NextResponse.json({ error: "A request can't be empty." }, { status: 400 });
    update.body = body.body.trim().slice(0, 4000);
  }
  if ("associated_system" in body) update.associated_system = cleanSystem(body.associated_system);
  if (KINDS.has(body.kind)) update.kind = body.kind;
  if (PRIORITIES.has(body.priority)) update.priority = body.priority;
  if (typeof body.status_note === "string") update.status_note = body.status_note.trim().slice(0, 1000) || null;

  if (STATUSES.has(body.status)) {
    update.status = body.status;
    if (body.status === "pending") {
      Object.assign(update, { sent_at: null, done_at: null, dropped_at: null });
    } else if (body.status === "sent") {
      Object.assign(update, { done_at: null, dropped_at: null });
    } else if (body.status === "done") {
      Object.assign(update, { done_at: now, dropped_at: null });
    } else if (body.status === "dropped") {
      Object.assign(update, { dropped_at: now, done_at: null });
    }
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { data, error } = await supabase.from("change_requests").update(update).in("id", ids).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // "Sent" keeps the first time it went out, so re-copying an item
  // doesn't make it look newer than it is.
  if (body.status === "sent") {
    await supabase.from("change_requests").update({ sent_at: now }).in("id", ids).is("sent_at", null);
    const { data: fresh } = await supabase.from("change_requests").select("*").in("id", ids);
    return NextResponse.json({ ok: true, items: fresh ?? data });
  }
  return NextResponse.json({ ok: true, items: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data, error } = await supabase.from("change_requests").delete().in("id", ids).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const deleted = ((data as Array<{ id: string }> | null) ?? []).map((r) => r.id);
  if (deleted.length < ids.length) {
    return NextResponse.json({
      ok: true,
      deleted,
      note: "Some items weren't deleted: only the workspace owner or an admin can delete. Mark them Dropped instead.",
    });
  }
  return NextResponse.json({ ok: true, deleted });
}
