import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptCredential } from "@/lib/crypto";
import { runHealthCheck, type IntegrationType, type AuthScheme } from "@/lib/integrations";

// Run live health checks.
//
// Body: { id: string } to check one, or { all: true } to check
// every integration the caller can see (RLS decides which).
//
// The credential is decrypted in memory for the duration of the
// outbound request and never returned to the client. What comes
// back is status + detail only.
//
// Checks run in parallel with Promise.allSettled so one hanging
// provider cannot block the rest, and a thrown error in one check
// cannot abort the batch.

export const maxDuration = 60;

type Row = {
  id: string;
  integration_type: IntegrationType;
  credential_ciphertext: string | null;
  credential_iv: string | null;
  credential_tag: string | null;
  base_url: string | null;
  auth_scheme: AuthScheme | null;
  auth_param_name: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const single: string | null = typeof body?.id === "string" ? body.id : null;

  let query = supabase
    .from("integrations")
    .select(
      "id, integration_type, credential_ciphertext, credential_iv, credential_tag, base_url, auth_scheme, auth_param_name"
    );
  if (single) query = query.eq("id", single);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as Row[] | null) ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, results: [] });
  }

  const settled = await Promise.allSettled(
    rows.map(async (row) => {
      let credential: string | null = null;
      if (row.credential_ciphertext && row.credential_iv && row.credential_tag) {
        try {
          credential = decryptCredential({
            ciphertext: row.credential_ciphertext,
            iv: row.credential_iv,
            tag: row.credential_tag,
          });
        } catch {
          // Decryption failure means the stored ciphertext does not
          // match the current key — usually a rotated env key.
          return {
            id: row.id,
            status: "failed" as const,
            detail:
              "Stored credential could not be decrypted. The encryption key may have changed; re-enter the credential.",
          };
        }
      }
      const result = await runHealthCheck(
        row.integration_type,
        credential,
        row.base_url,
        { scheme: row.auth_scheme ?? "bearer", paramName: row.auth_param_name }
      );
      return { id: row.id, status: result.status, detail: result.detail };
    })
  );

  const results = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          id: rows[i].id,
          status: "failed" as const,
          detail: "Health check crashed unexpectedly.",
        }
  );

  const now = new Date().toISOString();

  // Persist results. Sequential because the row count is small
  // (a handful of integrations per workspace) and this keeps the
  // Supabase connection pool calm.
  for (const r of results) {
    await supabase
      .from("integrations")
      .update({
        health_status: r.status,
        health_detail: r.detail,
        last_health_check_at: now,
      })
      .eq("id", r.id);

    await supabase.from("integration_events").insert({
      integration_id: r.id,
      actor_user_id: user.id,
      actor_email: user.email ?? "unknown",
      event_type: r.status === "healthy" ? "health_check_passed" : "health_check_failed",
      detail: r.detail,
    });
  }

  return NextResponse.json({ ok: true, checked: results.length, results });
}
