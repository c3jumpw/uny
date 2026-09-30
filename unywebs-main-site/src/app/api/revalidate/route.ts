import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Publish-to-live hook.
//
// The admin calls this after any content change. Without it a new guide
// would sit behind the hourly `revalidate` window; with it, Publish is
// live in about two seconds.
//
// Auth is a single shared secret rather than a signature: the only
// thing this endpoint can do is rebuild a public page from the
// database, so the worst a leaked secret buys is a cache flush. The
// secret still has to be set — an unset secret rejects every call
// rather than opening the endpoint up.

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET is not configured on the site." },
      { status: 500 }
    );
  }

  const provided =
    req.headers.get("x-revalidate-secret") ??
    new URL(req.url).searchParams.get("secret");

  if (provided !== secret) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const paths: string[] = Array.isArray(body?.paths)
    ? body.paths.filter((p: unknown): p is string => typeof p === "string")
    : [];

  // Default set covers the pages that list content. A guide or solution
  // change almost always affects more than the one page it lives on —
  // the home page shows featured tools, Get Started lists guides — so
  // refreshing the listings together avoids a half-updated site.
  const targets =
    paths.length > 0
      ? paths
      : ["/", "/solutions", "/guides", "/get-started"];

  const revalidated: string[] = [];
  for (const path of targets) {
    if (!path.startsWith("/")) continue;
    revalidatePath(path);
    revalidated.push(path);
  }

  return NextResponse.json({
    ok: true,
    revalidated,
    at: new Date().toISOString(),
  });
}
