import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptCredential, credentialHint } from "@/lib/crypto";
import { PROVIDERS, type IntegrationType } from "@/lib/integrations";

// Integrations CRUD.
//
// RLS does the authorization: a user can only touch rows where
// they are the workspace owner, plus super admins (all rows) and
// technical admins (granted rows). We do not re-check here — the
// policies are the single source of truth, so there is no way for
// app-layer and DB-layer rules to drift apart.
//
// Credentials are encrypted before insert. The plaintext exists
// only in this request's memory and is never logged.

function isValidType(t: unknown): t is IntegrationType {
  return typeof t === "string" && t in PROVIDERS;
}

async function logEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  integrationId: string,
  actorId: string,
  actorEmail: string,
  eventType: string,
  detail: string
) {
  await supabase.from("integration_events").insert({
    integration_id: integrationId,
    actor_user_id: actorId,
    actor_email: actorEmail,
    event_type: eventType,
    detail,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !isValidType(body.integration_type)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const integrationType: IntegrationType = body.integration_type;

  const credential: string | null =
    typeof body.credential === "string" && body.credential.trim()
      ? body.credential.trim()
      : null;

  let encFields: Record<string, string | null> = {
    credential_ciphertext: null,
    credential_iv: null,
    credential_tag: null,
    credential_hint: null,
  };
  if (credential) {
    try {
      const enc = encryptCredential(credential);
      encFields = {
        credential_ciphertext: enc.ciphertext,
        credential_iv: enc.iv,
        credential_tag: enc.tag,
        credential_hint: credentialHint(credential),
      };
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "encryption_failed" },
        { status: 500 }
      );
    }
  }

  // workspace_owner_id defaults to the caller. A super admin or
  // technical admin can create an integration on a client's behalf
  // by passing workspace_owner_id explicitly; RLS decides whether
  // the insert is allowed.
  const ownerId: string =
    typeof body.workspace_owner_id === "string" ? body.workspace_owner_id : user.id;

  const { data, error } = await supabase
    .from("integrations")
    .insert({
      workspace_owner_id: ownerId,
      name: body.name.trim().slice(0, 120),
      associated_system: body.associated_system?.trim()?.slice(0, 120) || null,
      custom_provider_name: body.custom_provider_name?.trim()?.slice(0, 120) || null,
      auth_scheme:
        typeof body.auth_scheme === "string" &&
        ["bearer", "header", "query", "basic", "none"].includes(body.auth_scheme)
          ? body.auth_scheme
          : "bearer",
      auth_param_name: body.auth_param_name?.trim()?.slice(0, 120) || null,
      integration_type: integrationType,
      ...encFields,
      env_var_name: body.env_var_name?.trim()?.slice(0, 120) || null,
      callback_url: body.callback_url?.trim()?.slice(0, 500) || null,
      base_url: body.base_url?.trim()?.slice(0, 500) || null,
      expires_at: body.expires_at || null,
      last_regenerated_at: credential ? new Date().toISOString() : null,
      account_identifier: body.account_identifier?.trim()?.slice(0, 200) || null,
      account_ownership:
        body.account_ownership === "agency_master" ? "agency_master" : "client_own",
      notes: body.notes?.trim()?.slice(0, 2000) || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent(
    supabase,
    data.id,
    user.id,
    user.email ?? "unknown",
    "created",
    `Integration "${body.name}" created (${PROVIDERS[integrationType].label}).`
  );

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
  const changedFields: string[] = [];

  if (typeof body.name === "string") {
    updates.name = body.name.trim().slice(0, 120);
    changedFields.push("name");
  }
  if (
    typeof body.auth_scheme === "string" &&
    ["bearer", "header", "query", "basic", "none"].includes(body.auth_scheme)
  ) {
    updates.auth_scheme = body.auth_scheme;
    changedFields.push("auth_scheme");
  }
  for (const f of [
    "associated_system",
    "custom_provider_name",
    "auth_param_name",
    "env_var_name",
    "callback_url",
    "base_url",
    "account_identifier",
    "notes",
  ] as const) {
    if (typeof body[f] === "string") {
      updates[f] = body[f].trim() || null;
      changedFields.push(f);
    }
  }
  if (body.expires_at !== undefined) {
    updates.expires_at = body.expires_at || null;
    changedFields.push("expires_at");
  }
  if (body.account_ownership === "agency_master" || body.account_ownership === "client_own") {
    updates.account_ownership = body.account_ownership;
    changedFields.push("account_ownership");
  }

  // Credential rotation: only if a new one was supplied.
  let rotated = false;
  if (typeof body.credential === "string" && body.credential.trim()) {
    try {
      const enc = encryptCredential(body.credential.trim());
      updates.credential_ciphertext = enc.ciphertext;
      updates.credential_iv = enc.iv;
      updates.credential_tag = enc.tag;
      updates.credential_hint = credentialHint(body.credential.trim());
      updates.last_regenerated_at = new Date().toISOString();
      // A rotated credential has not been verified yet.
      updates.health_status = "unknown";
      updates.health_detail = "Credential rotated; not yet checked.";
      rotated = true;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "encryption_failed" },
        { status: 500 }
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { error } = await supabase.from("integrations").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent(
    supabase,
    body.id,
    user.id,
    user.email ?? "unknown",
    rotated ? "credential_rotated" : "metadata_updated",
    rotated
      ? "Credential rotated. Value redacted."
      : `Updated: ${changedFields.join(", ")}.`
  );

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

  // Events cascade-delete with the integration, so log to the
  // console for the operator rather than to a row that is about
  // to disappear.
  console.log(`[integrations] ${user.email} deleted integration ${id}`);

  const { error } = await supabase.from("integrations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
