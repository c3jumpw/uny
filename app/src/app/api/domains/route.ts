import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Domains CRUD. RLS handles authorization, same as integrations:
// owner, super admin, granted technical admin, or a vault share
// scoped to 'all' or to this domain's system tag.

const TEXT_FIELDS = [
  "domain_name",
  "associated_system",
  "registrar",
  "registrar_account",
  "dns_provider",
  "dns_account",
  "nameservers",
  "ssl_provider",
  "notes",
] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.domain_name !== "string" || !body.domain_name.trim()) {
    return NextResponse.json({ error: "domain_name_required" }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    workspace_owner_id:
      typeof body.workspace_owner_id === "string" ? body.workspace_owner_id : user.id,
    // Strip scheme and trailing slash so "https://example.com/" and
    // "example.com" don't become two different records.
    domain_name: body.domain_name
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .toLowerCase()
      .slice(0, 253),
    expires_at: body.expires_at || null,
    ssl_expires_at: body.ssl_expires_at || null,
    auto_renew: body.auto_renew === true,
    account_ownership:
      body.account_ownership === "agency_master" ? "agency_master" : "client_own",
    registrar_credential_id:
      typeof body.registrar_credential_id === "string" && body.registrar_credential_id
        ? body.registrar_credential_id
        : null,
  };
  for (const f of TEXT_FIELDS) {
    if (f === "domain_name") continue;
    row[f] = typeof body[f] === "string" && body[f].trim() ? body[f].trim() : null;
  }

  const { data, error } = await supabase
    .from("domains")
    .insert(row)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) {
    if (typeof body[f] === "string") {
      let v = body[f].trim();
      if (f === "domain_name") {
        v = v.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
        if (!v) continue;
      }
      updates[f] = v || null;
    }
  }
  if (body.expires_at !== undefined) updates.expires_at = body.expires_at || null;
  if (body.ssl_expires_at !== undefined)
    updates.ssl_expires_at = body.ssl_expires_at || null;
  if (typeof body.auto_renew === "boolean") updates.auto_renew = body.auto_renew;
  if (body.account_ownership === "agency_master" || body.account_ownership === "client_own")
    updates.account_ownership = body.account_ownership;
  if (body.registrar_credential_id !== undefined)
    updates.registrar_credential_id = body.registrar_credential_id || null;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  const { error } = await supabase.from("domains").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { error } = await supabase.from("domains").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
