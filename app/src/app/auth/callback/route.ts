import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where Supabase sends people back after they click a link in an auth
// email. By the time the browser arrives here Supabase has already
// verified the token; this route only decides where to go next.
//
//   flow=signup (or no flow: older emails, Site-URL fallbacks)
//     -> /login?confirmed=1. Confirming an email never logs you in
//        and never jumps to checkout: the person logs in with the
//        password they chose, then picks a plan. That order also
//        catches a mistyped password at signup immediately.
//   flow=recovery or next=/reset-password
//     -> exchange the code for a session, then /reset-password
//   error / error_description in the query
//     -> /login?error=… so the login page can explain and offer a
//        fresh confirmation email.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

function safeNext(next: string | null): string | null {
  // Only same-site paths. "//evil.com" and absolute URLs are refused.
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const base = APP_URL || url.origin;

  const code = searchParams.get("code");
  const flow = searchParams.get("flow");
  const next = safeNext(searchParams.get("next"));
  const plan = searchParams.get("plan");
  const err = searchParams.get("error_description") || searchParams.get("error");

  if (err) {
    const code = searchParams.get("error_code") || "";
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(err)}${code ? `&error_code=${encodeURIComponent(code)}` : ""}`
    );
  }

  const isRecovery = flow === "recovery" || next === "/reset-password";
  if (isRecovery) {
    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(
          `${base}/forgot-password?error=${encodeURIComponent("That reset link has expired or was already used. Request a new one below.")}`
        );
      }
    }
    return NextResponse.redirect(`${base}/reset-password`);
  }

  if (flow === "magiclink" && code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(`${base}${next ?? "/dashboard"}`);
  }

  // Signup confirmation (the default).
  const qs = new URLSearchParams({ confirmed: "1" });
  if (plan === "basic" || plan === "premium") qs.set("plan", plan);
  return NextResponse.redirect(`${base}/login?${qs.toString()}`);
}
