#!/usr/bin/env bash
# Re-take every guide and tour screenshot from the demo workspace
# (/guide/demo, sample data only), in light and dark, then check the
# tour is complete. CI runs this on every push to main
# (.github/workflows/guide-screenshots.yml); run it locally with
#   npm run capture:guide
# Needs Playwright with Chromium (npx playwright install chromium).
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-$(mktemp -d)}"
PORT=3123
export GUIDE_CAPTURE=1
# The demo screens never call Supabase; the auth pages only need a URL
# and key shaped value to render.
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:9}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-capture-only}"

# One fixed instant for the server and the browser, so dates in the
# sample data render the same on every run (see scripts/fake-now.cjs).
export GUIDE_NOW="${GUIDE_NOW:-2026-11-18T14:00:00Z}"
export TZ=UTC

stop() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "$PORT/tcp" >/dev/null 2>&1 || true
  elif [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap stop EXIT
stop

npx next build
NODE_OPTIONS="--require $PWD/scripts/fake-now.cjs" npx next start -p "$PORT" > "$OUT/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:$PORT/guide/demo?shot=overview" && break
  sleep 1
done

node scripts/capture-guide.cjs "$OUT"
node scripts/capture-guide.cjs --convert "$OUT"
node scripts/check-guide.mjs
echo "Screenshots refreshed from $OUT"
