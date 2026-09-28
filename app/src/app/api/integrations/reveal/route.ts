import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptCredential } from "@/lib/crypto";

// Reveal a stored credential.
//
// Plaintext is never rendered into the page on load. It is fetched
// only when someone explicitly asks, which means a shoulder-surfer
// looking at an open vault tab sees hints, not secrets, and a page
// left open in a browser's back-forward cache holds nothing.
//
// Authorization is RLS. The select below returns a row only if the
// caller is the owner, a super admin, a technical admin with a live
// grant, or the holder of a vault share covering this credential.
// Anything else comes back empty and is reported as not-found,
// which is also the correct answer for a credential that does not
// exist — no way to probe for ids this way.
//
// Every successful reveal is written to integration_events. A
// credential vault without an access log tells you what you have
// but never who looked at it, and "who had this key before it
// leaked" is exactly the question you need answered afterwards.

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("integrations")
    .select(
      "id, name, credential_ciphertext, credential_iv, credential_tag, workspace_owner_id"
    )
    .eq("id", body.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "not_found_or_forbidden" }, { status: 404 });
  }

  const row = data as {
    id: string;
    name: string;
    credential_ciphertext: string | null;
    credential_iv: string | null;
    credential_tag: string | null;
  };

  if (!row.credential_ciphertext || !row.credential_iv || !row.credential_tag) {
    return NextResponse.json(
      { error: "No credential is stored for this entry." },
      { status: 404 }
    );
  }

  let plaintext: string;
  try {
    plaintext = decryptCredential({
      ciphertext: row.credential_ciphertext,
      iv: row.credential_iv,
      tag: row.credential_tag,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "This credential could not be decrypted. The encryption key may have changed since it was saved — re-enter the credential to fix it.",
      },
      { status: 500 }
    );
  }

  // Log the access. Deliberately after a successful decrypt, so the
  // log records reveals that actually handed over a secret rather
  // than failed attempts, and deliberately not awaited-and-checked
  // into a failure: a logging hiccup should not deny someone a
  // credential they are entitled to.
  const { error: logError } = await supabase.from("integration_events").insert({
    integration_id: row.id,
    actor_user_id: user.id,
    actor_email: user.email ?? "unknown",
    event_type: "credential_revealed",
    detail: `Credential revealed by ${user.email ?? "unknown"}.`,
  });
  if (logError) {
    console.error("[reveal] audit log write failed", logError);
  }

  return NextResponse.json({
    ok: true,
    credential: plaintext,
    // Echoed back so the UI can confirm it is showing the secret it
    // asked for, rather than a stale response from a previous click.
    id: row.id,
  });
}
