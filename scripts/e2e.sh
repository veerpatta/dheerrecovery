#!/usr/bin/env bash
# Build, serve, and smoke-test the app against a throwaway Postgres.
# Usage: DATABASE_URL=postgres://... scripts/e2e.sh [port]
set -uo pipefail

PORT="${1:-3111}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# A `next start` wrapper spawns a detached `next-server` child; killing the
# wrapper alone leaves the old build serving the port and silently breaks
# Server Action IDs on the next run.
kill_port() {
  local pids
  pids=$(ss -lptnH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  pkill -9 -f "next-server" 2>/dev/null
  sleep 1
  return 0
}

kill_port
npx next start -p "$PORT" > /tmp/next-$PORT.log 2>&1 &
WRAPPER=$!

ready=""
for _ in $(seq 1 30); do
  sleep 1
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" 2>/dev/null)" = "200" ]; then
    ready=1
    break
  fi
done

if [ -z "$ready" ]; then
  echo "server failed to start on :$PORT"
  tail -20 "/tmp/next-$PORT.log"
  kill_port
  exit 1
fi

# Fail loudly rather than silently testing a stale build.
if grep -q EADDRINUSE "/tmp/next-$PORT.log"; then
  echo "port $PORT was already serving a stale build"
  kill_port
  exit 1
fi

CHROME_PATH="${CHROME_PATH:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}" \
  BASE_URL="http://127.0.0.1:$PORT" node scripts/smoke.mjs
STATUS=$?

kill "$WRAPPER" 2>/dev/null
kill_port
exit $STATUS
