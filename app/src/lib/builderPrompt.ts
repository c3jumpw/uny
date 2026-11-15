// The prompt Unywebs pastes into Claude (or any AI builder) when building
// or rebuilding a client app, so every app ships with the UnyBase licence
// check. Shown with a copy button on /admin/sites and reproduced in the
// Client App Licensing Playbook. Keep the two in step.
//
// Written without backticks or "${" so it can live in a template literal:
// code blocks use ~~~ fences, which Markdown treats the same as ```.

export const BUILDER_PROMPT_VERSION = "2026-11-15";

export const BUILDER_PROMPT = `# Add the UnyBase licence check to this app

This app is built and maintained by Unywebs. Every Unywebs app must include the UnyBase licence check, which lets Unywebs pause the app from its admin console if the client's account is suspended. Add it exactly as specified here, adapted to this app's framework, without changing anything else in the app. (Spec version ${BUILDER_PROMPT_VERSION}.)

## How the check works

- The app asks UnyBase whether it may run:
  GET https://unybase.unywebs.com/api/license/status
  with the header "Authorization: Bearer <licence key>".
- The licence key comes from an environment variable. Never hard-code it, never commit it, and add the variable name (with no value) to .env.example and the README.
  - Apps with a server: UNYBASE_LICENSE_KEY, server-side only. It must never be sent to the browser (no NEXT_PUBLIC_ or VITE_ prefix).
  - Browser-only apps and static sites: use the hosted script described under "Browser-only apps" instead of writing your own check.
- Successful answers are HTTP 200 JSON: { "status", "site", "message", "owner_message", "checked_at", "recheck_after" }.

| status | What the app must do |
| --- | --- |
| active | Run normally. |
| grace | Run normally. Show owner_message as a dismissible notice to the app's signed-in owners or admins only, never to public visitors or end customers. If the app has no admin area, log it on the server instead. |
| paused | Replace every human-facing page with the paused screen described below. |

- Anything else must FAIL OPEN: a 401 (unknown or retired key), 400, 5xx, timeout, network error or unreadable JSON means keep using the last successful answer if there is one, otherwise behave as "active", and log a warning. The app must never go down because the check failed.

## Caching and timeouts

- Cache the last successful answer in memory for recheck_after seconds (default 60). Never call UnyBase on every request.
- Time out the request after 3 seconds. After any failure, wait 60 seconds before trying again and keep serving the cached (or "active") answer meanwhile, so an outage never slows the app down.

## The paused screen

- A plain, self-contained page: heading "Temporarily unavailable", body text = message from the response (fallback: "Please check back soon.").
- Server-rendered responses use HTTP 503 with "Retry-After: 300", "Cache-Control: no-store" and "X-Robots-Tag: noindex".
- It must not mention payment, billing, debt or Unywebs, must not reveal any of the app's content, and needs no external assets. It should read well in light and dark mode.
- The app's own JSON API routes (the ones its pages call) answer 503 { "error": "paused" } while paused.

## Keep these running while paused

- Inbound webhooks (payment providers, form tools, systeme.io and similar), cron and scheduled jobs, background workers and health checks. Exclude their routes from the check.
- Static assets.
- Data is never touched: do not delete, change or lock any data, accounts or files because of the licence status. Pausing only hides the front end, and restoring must work instantly with no data loss.

## Where to put it

- Next.js (App Router): a request middleware (middleware.ts, or proxy.ts exporting proxy() on Next.js 16 and later) plus lib/unybase-license.ts. Use the reference implementation below. If a middleware already exists (for example Supabase auth), run the licence check first and then the existing logic, in the same file.
- Other server frameworks (Express, Remix, SvelteKit, Nuxt, Astro SSR, Django, Rails, Laravel and so on): the framework's request middleware or hook that runs before page and API routes, with the same rules and exclusions.
- Browser-only apps (Vite or React SPA, plain HTML, Webflow, Wix or Squarespace custom code): add this as the first script in <head> and nothing else is needed for pausing:
  <script src="https://unybase.unywebs.com/license.js" data-key="LICENCE_KEY"></script>
  In Vite, write data-key="%VITE_UNYBASE_LICENSE_KEY%" so the value comes from the environment. In a browser-only app the key is visible to anyone, which is acceptable: it can only read this site's on/off status. To show the grace notice to staff, read window.unybaseLicense or listen for the "unybase-license" window event (its detail is the same object) inside the staff-only area.
- Mobile apps (React Native, Expo): check on launch and whenever the app returns to the foreground, with the same caching and fail-open rules, and show the paused screen as a full-screen view. Keep the key in the app's build config, never in source control.

## Local testing

- Support UNYBASE_LICENSE_SIMULATE=paused or UNYBASE_LICENSE_SIMULATE=grace, honoured only when NODE_ENV is not "production", so the paused screen and the grace notice can be tested locally without calling UnyBase.
- Do not add any other way to skip or override the check: no bypass flag, query parameter, cookie, header or admin toggle.

## Reference implementation (Next.js App Router, TypeScript)

lib/unybase-license.ts:

~~~ts
export type License = {
  status: "active" | "grace" | "paused";
  site?: string;
  message?: string | null;
  owner_message?: string | null;
  recheck_after?: number;
};

const ENDPOINT = "https://unybase.unywebs.com/api/license/status";
const ACTIVE: License = { status: "active" };
let cached: License | null = null;
let nextCheckAt = 0;

function simulated(): License | null {
  const sim = process.env.UNYBASE_LICENSE_SIMULATE;
  if (process.env.NODE_ENV === "production") return null;
  if (sim === "paused") return { status: "paused", message: null };
  if (sim === "grace") return { status: "grace", owner_message: "Simulated payment problem." };
  return null;
}

export async function getLicense(host?: string): Promise<License> {
  const sim = simulated();
  if (sim) return sim;
  const key = process.env.UNYBASE_LICENSE_KEY;
  if (!key) return ACTIVE; // not configured: never block (the Unywebs redeploy checklist catches this)
  if (Date.now() < nextCheckAt) return cached ?? ACTIVE;
  try {
    const headers: Record<string, string> = { Authorization: "Bearer " + key };
    if (host) headers["X-UnyBase-Site"] = host;
    const res = await fetch(ENDPOINT, { headers, cache: "no-store", signal: AbortSignal.timeout(3000) });
    const body = await res.json().catch(() => null);
    if (res.ok && body && ["active", "grace", "paused"].includes(body.status)) {
      cached = body as License;
      nextCheckAt = Date.now() + (Number(body.recheck_after) || 60) * 1000;
      return cached;
    }
    console.warn("[unybase] licence check answered", res.status, body && body.status);
  } catch (err) {
    console.warn("[unybase] licence check failed, keeping the last answer", err);
  }
  nextCheckAt = Date.now() + 60_000;
  return cached ?? ACTIVE;
}

export function pausedPage(message?: string | null): string {
  const text = (message || "Please check back soon.")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
    '<title>Temporarily unavailable</title><style>' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;' +
    'font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;color:#1d2433;text-align:center}' +
    'main{max-width:420px}h1{font-size:22px;margin:0 0 8px;font-weight:600}p{margin:0;color:#4a5466}' +
    '@media (prefers-color-scheme:dark){body{background:#0f141c;color:#e7ebf2}p{color:#a9b2c3}}' +
    '</style></head><body><main><h1>Temporarily unavailable</h1><p>' + text + '</p></main></body></html>';
}
~~~

middleware.ts (proxy.ts with export function proxy on Next.js 16+):

~~~ts
import { NextResponse, type NextRequest } from "next/server";
import { getLicense, pausedPage } from "./lib/unybase-license";

export async function middleware(req: NextRequest) {
  const license = await getLicense(req.nextUrl.host);
  if (license.status !== "paused") return NextResponse.next();

  const headers = { "Cache-Control": "no-store", "Retry-After": "300", "X-Robots-Tag": "noindex" };
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "paused" }, { status: 503, headers });
  }
  return new NextResponse(pausedPage(license.message), {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = {
  // Everything except Next internals, static files, webhooks and cron.
  // Add any other webhook, cron or health-check paths this app has.
  matcher: [
    "/((?!_next/|api/webhooks|api/cron|api/health|favicon.ico|robots.txt|sitemap.xml|.*\\\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
~~~

For the grace notice, call getLicense() in the admin area's server layout and render owner_message in a banner when status is "grace".

## When you are done

Reply with:
1. The files you added or changed.
2. The environment variable to set (UNYBASE_LICENSE_KEY, or VITE_UNYBASE_LICENSE_KEY for a Vite app) and where.
3. The routes you excluded from the check, and why.
4. How you tested it: the app runs with no key; a wrong key logs a warning and the app keeps running; UNYBASE_LICENSE_SIMULATE=paused shows the paused screen locally while webhooks still answer.
`;
