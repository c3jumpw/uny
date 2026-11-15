import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { getUserRole } from "@/lib/admin";
import { sendNotification } from "@/lib/email";
import {
  cleanText,
  escapeHtml,
  isSiteMode,
  newLicenseKey,
  normaliseDomain,
  type SiteMode,
  type SiteState,
} from "@/lib/licensing";

// Client sites: register, switch, rotate, retire. Super admin only.
//
// Like billing exemptions, the kill switch is a commercial lever that
// belongs to the company account, so it does not travel with a client's
// technical-admin grant. Writes go through the signed-in session, so the
// table's RLS (is_super_admin) is a second gate behind the role check.
//
// POST  { site_name, client_name?, domain?, owner_email?, notes? }
//       -> { id, key }            the key is shown once, never stored
// PATCH { id, action: "set_mode", mode: "auto"|"paused"|"active", reason? }
//       { id, action: "rotate_key" }                      -> { key }
//       { id, action: "retire" }
//       { id, action: "edit", site_name?, client_name?, domain?, owner_email?, notes? }

type SiteRow = {
  id: string;
  owner_id: string | null;
  site_name: string;
  domain: string | null;
  status_override: SiteMode;
  effective_status: SiteState | null;
  revoked_at: string | null;
};

const SITE_COLUMNS = "id, owner_id, site_name, domain, status_override, effective_status, revoked_at";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (getUserRole(user.email) !== "super_admin") {
    return {
      error: NextResponse.json(
        { error: "Only a super admin can manage client sites." },
        { status: 403 }
      ),
    };
  }
  return { supabase, user };
}

async function ownerIdForEmail(email: string): Promise<string | null> {
  const { data } = await serviceClient().rpc("find_user_id_by_email", { p_email: email });
  return typeof data === "string" ? data : null;
}

async function emailForUser(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await serviceClient().rpc("email_for_user", { p_user: userId });
  return typeof data === "string" ? data : null;
}

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin();
  if ("error" in gate) return gate.error;
  const { supabase, user } = gate;

  const body = await req.json().catch(() => null);
  const siteName = cleanText(body?.site_name, 120);
  if (!siteName) return NextResponse.json({ error: "Give the site a name." }, { status: 400 });

  const domainInput = cleanText(body?.domain, 300);
  const domain = normaliseDomain(domainInput);
  if (domainInput && !domain) {
    return NextResponse.json({ error: "That domain doesn't look right." }, { status: 400 });
  }

  const ownerEmail = cleanText(body?.owner_email, 320)?.toLowerCase() ?? null;
  let ownerId: string | null = null;
  if (ownerEmail) {
    ownerId = await ownerIdForEmail(ownerEmail);
    if (!ownerId) {
      return NextResponse.json(
        {
          error:
            "No UnyBase account uses that email. Leave it blank to register the site without one.",
        },
        { status: 400 }
      );
    }
  }

  const { key, hash, prefix } = newLicenseKey();
  const { data, error } = await supabase
    .from("licensed_sites")
    .insert({
      owner_id: ownerId,
      site_name: siteName,
      client_name: cleanText(body?.client_name, 120),
      domain,
      notes: cleanText(body?.notes, 1000),
      key_hash: hash,
      key_prefix: prefix,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not save the site." }, { status: 500 });
  }

  await supabase.from("admin_actions").insert({
    admin_user_id: user.id,
    admin_email: user.email ?? "unknown",
    target_user_id: ownerId,
    target_email: ownerEmail,
    action_type: "site_registered",
    notes: siteName + (domain ? ` (${domain})` : ""),
    metadata: { site_id: data.id },
  });

  return NextResponse.json({ ok: true, id: data.id, key });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireSuperAdmin();
  if ("error" in gate) return gate.error;
  const { supabase, user } = gate;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const action = typeof body?.action === "string" ? body.action : null;
  if (!id || !action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: before } = await supabase
    .from("licensed_sites_admin")
    .select(SITE_COLUMNS)
    .eq("id", id)
    .maybeSingle<SiteRow>();
  if (!before) return NextResponse.json({ error: "Site not found." }, { status: 404 });
  if (before.revoked_at) {
    return NextResponse.json({ error: "This site is retired. Register it again instead." }, { status: 409 });
  }

  const ownerEmail = await emailForUser(before.owner_id);
  const nowIso = new Date().toISOString();
  const audit = (actionType: string, notes: string, metadata: Record<string, unknown> = {}) =>
    supabase.from("admin_actions").insert({
      admin_user_id: user.id,
      admin_email: user.email ?? "unknown",
      target_user_id: before.owner_id,
      target_email: ownerEmail,
      action_type: actionType,
      notes,
      metadata: { site_id: id, ...metadata },
    });

  if (action === "set_mode") {
    const mode = body?.mode;
    if (!isSiteMode(mode)) return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
    const reason = cleanText(body?.reason, 500);

    const { error } = await supabase
      .from("licensed_sites")
      .update({
        status_override: mode,
        override_reason: mode === "auto" ? null : reason,
        override_set_at: nowIso,
        override_set_by: user.id,
        updated_at: nowIso,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: after } = await supabase
      .from("licensed_sites_admin")
      .select(SITE_COLUMNS)
      .eq("id", id)
      .maybeSingle<SiteRow>();
    const wasPaused = before.effective_status === "paused";
    const nowPaused = after?.effective_status === "paused";

    const label = { auto: "site_auto", paused: "site_paused", active: "site_always_on" }[mode];
    await audit(label, `${before.site_name}${reason ? `: ${reason}` : ""}`, {
      from: before.effective_status,
      to: after?.effective_status ?? null,
    });

    // A pause nobody explains is a support ticket. Tell the owner when
    // the site actually changes between paused and running.
    let emailed = false;
    if (ownerEmail && wasPaused !== nowPaused) {
      const result = await sendNotification({
        to: ownerEmail,
        toUserId: before.owner_id,
        template: nowPaused ? "site_paused" : "site_restored",
        vars: {
          siteName: escapeHtml(before.site_name),
          ...(before.domain ? { domain: escapeHtml(before.domain) } : {}),
          ...(nowPaused && reason ? { reason: escapeHtml(reason) } : {}),
        },
        metadata: { site_id: id, by: user.email },
      });
      emailed = result.ok && result.status !== "duplicate";
      if (!result.ok) console.error("[sites] owner email failed", result.detail);
    }

    return NextResponse.json({ ok: true, status: after?.effective_status ?? null, emailed });
  }

  if (action === "rotate_key") {
    const { key, hash, prefix } = newLicenseKey();
    const { error } = await supabase
      .from("licensed_sites")
      .update({ key_hash: hash, key_prefix: prefix, key_rotated_at: nowIso, updated_at: nowIso })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("site_key_rotated", before.site_name);
    return NextResponse.json({ ok: true, key });
  }

  if (action === "retire") {
    const { error } = await supabase
      .from("licensed_sites")
      .update({ revoked_at: nowIso, updated_at: nowIso })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("site_retired", before.site_name);
    return NextResponse.json({ ok: true });
  }

  if (action === "edit") {
    const patch: Record<string, unknown> = { updated_at: nowIso };
    if ("site_name" in body) {
      const name = cleanText(body.site_name, 120);
      if (!name) return NextResponse.json({ error: "Give the site a name." }, { status: 400 });
      patch.site_name = name;
    }
    if ("client_name" in body) patch.client_name = cleanText(body.client_name, 120);
    if ("notes" in body) patch.notes = cleanText(body.notes, 1000);
    if ("domain" in body) {
      const raw = cleanText(body.domain, 300);
      const domain = normaliseDomain(raw);
      if (raw && !domain) {
        return NextResponse.json({ error: "That domain doesn't look right." }, { status: 400 });
      }
      patch.domain = domain;
    }
    if ("owner_email" in body) {
      const email = cleanText(body.owner_email, 320)?.toLowerCase() ?? null;
      if (email) {
        const ownerId = await ownerIdForEmail(email);
        if (!ownerId) {
          return NextResponse.json({ error: "No UnyBase account uses that email." }, { status: 400 });
        }
        patch.owner_id = ownerId;
      } else {
        patch.owner_id = null;
      }
    }
    const { error } = await supabase.from("licensed_sites").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("site_edited", before.site_name, {
      fields: Object.keys(patch).filter((k) => k !== "updated_at"),
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
