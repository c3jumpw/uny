import { NextRequest, NextResponse } from "next/server";
import { serviceClient, hasServiceRole } from "@/lib/supabase/service";

// Licence check for the client apps Unywebs builds (the kill switch).
//
//   GET /api/license/status
//   Authorization: Bearer unyl_<48 hex>     (or X-UnyBase-Key: unyl_…)
//
//   200 { status: "active" | "grace" | "paused", site, message,
//         owner_message, checked_at, recheck_after }
//   401 { status: "unknown_key" }   wrong, malformed or retired key
//   400 { status: "missing_key" }
//   503 { status: "unavailable" }   our problem, never the client's
//
// Client apps fail open: anything other than a 200 "paused" means keep
// running. The decision itself lives in SQL (licensed_site_state) so
// this route and /admin/sites can never disagree. Open to any origin:
// browser-only sites call it directly, and a key can only read the
// on/off state of its own site.

export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-UnyBase-Key, X-UnyBase-Site",
  "Access-Control-Max-Age": "86400",
};

function reply(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS, "Cache-Control": "no-store" },
  });
}

function keyFrom(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(\S+)\s*$/i)?.[1];
  return (bearer ?? req.headers.get("x-unybase-key") ?? "").trim();
}

// Where the check came from, shown on /admin/sites so you can confirm a
// fresh deploy is calling in. Browsers send Origin; server-side checks
// may name themselves with X-UnyBase-Site.
function originFrom(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") return origin.slice(0, 200);
  const site = req.headers.get("x-unybase-site");
  return site ? site.slice(0, 200) : null;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const key = keyFrom(req);
  if (!key) return reply({ status: "missing_key" }, 400);
  if (!hasServiceRole()) return reply({ status: "unavailable" }, 503);

  const { data, error } = await serviceClient().rpc("license_status", {
    p_key: key,
    p_origin: originFrom(req),
  });
  if (error || !data || typeof data !== "object") {
    console.error("[license] status lookup failed", error?.message);
    return reply({ status: "unavailable" }, 503);
  }

  const body = data as Record<string, unknown>;
  return reply(body, body.status === "unknown_key" ? 401 : 200);
}
