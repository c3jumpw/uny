import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkoutUrlForPlan } from "@/lib/checkoutUrls";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const plan = searchParams.get("plan");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  // If they came from signup with a plan selected, send them to checkout.
  // checkoutUrlForPlan validates against a fixed allowlist — no open-redirect risk.
  if (plan) {
    const url = checkoutUrlForPlan(plan);
    if (url) return NextResponse.redirect(url);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
