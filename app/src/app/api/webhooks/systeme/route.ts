import { NextResponse } from "next/server";

// Systeme.io webhook endpoint.
//
// Phase 1 (now): accept and log the payload so nothing 404s while the
// admin dashboard is being wired up. Returns 200 so systeme.io doesn't
// retry the delivery.
//
// Phase 2 (next): parse subscription events (payment success, payment
// failure, subscription cancelled), persist to Supabase, and surface
// in /admin.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    // Intentionally console.log — Vercel captures function logs so we
    // can inspect real payloads to build the phase-2 parser against.
    console.log("[systeme webhook]", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[systeme webhook] error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// Some webhook UIs verify the endpoint with a GET first.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "systeme" });
}
