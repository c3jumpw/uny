import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, hasServiceRole } from "@/lib/supabase/service";
import { isCycle, isPlanId } from "@/lib/plans";

// Records which plan and billing cycle someone headed to checkout
// with. Owners cannot write their own subscription_status (that would
// let anyone mark themselves paid), so this goes through the service
// role and touches only the "intended" columns.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!isPlanId(body?.plan) || !isCycle(body?.cycle)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!hasServiceRole()) return NextResponse.json({ ok: false, skipped: true });

  const service = serviceClient();
  const now = new Date().toISOString();
  await service
    .from("subscription_status")
    .update({ intended_plan: body.plan, plan_selected_at: now, updated_at: now })
    .eq("user_id", user.id);
  // Own statement: the cycle column arrives with a later migration.
  await service
    .from("subscription_status")
    .update({ intended_cycle: body.cycle })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
