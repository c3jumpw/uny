import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LATEST_CHANGE_ID } from "@/lib/changelog";

// Records that the signed-in person has seen every change up to the
// latest one, so What's new doesn't pop up again on any device. Kept in
// their own user_metadata (a short id, nothing else): it only affects
// their own popup, so there is nothing to protect beyond the session.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!LATEST_CHANGE_ID || user.user_metadata?.changelog_seen === LATEST_CHANGE_ID) {
    return NextResponse.json({ ok: true });
  }
  const { error } = await supabase.auth.updateUser({ data: { changelog_seen: LATEST_CHANGE_ID } });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
