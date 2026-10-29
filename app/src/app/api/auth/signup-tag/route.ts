import { NextRequest, NextResponse } from "next/server";
import { serviceClient, hasServiceRole } from "@/lib/supabase/service";
import { addTag, SIGNUP_TAG } from "@/lib/systeme";

// Tags a brand-new signup in systeme.io ("free signup" segment).
//
// Called by the signup form right after Supabase creates the account.
// It is unauthenticated (the person is not logged in yet), so it only
// acts on an email that belongs to an account created in the last 15
// minutes and not yet tagged. That makes it useless for tagging
// arbitrary addresses.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) return NextResponse.json({ ok: false }, { status: 400 });
  if (!hasServiceRole()) return NextResponse.json({ ok: false, skipped: true });

  const service = serviceClient();
  const { data: userId } = await service.rpc("find_user_id_by_email", { p_email: email });
  if (typeof userId !== "string") return NextResponse.json({ ok: false });

  const { data: createdAt } = await service.rpc("user_created_at", { p_user: userId });
  const ageMs = typeof createdAt === "string" ? Date.now() - new Date(createdAt).getTime() : Infinity;
  if (ageMs > 15 * 60 * 1000) return NextResponse.json({ ok: false });

  const { data: row } = await service
    .from("subscription_status")
    .select("systeme_signup_tagged_at")
    .eq("user_id", userId)
    .maybeSingle();
  if ((row as { systeme_signup_tagged_at?: string | null } | null)?.systeme_signup_tagged_at) {
    return NextResponse.json({ ok: true, already: true });
  }

  const r = await addTag(email, SIGNUP_TAG, userId);
  if (r.ok) {
    await service
      .from("subscription_status")
      .update({ systeme_signup_tagged_at: new Date().toISOString() })
      .eq("user_id", userId);
  }
  return NextResponse.json({ ok: r.ok, skipped: r.skipped ?? false });
}
