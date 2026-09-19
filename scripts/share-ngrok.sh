#!/usr/bin/env bash
set -euo pipefail

if ! command -v ngrok >/dev/null 2>&1; then
  echo 'Install ngrok and configure your auth token first: https://ngrok.com/download' >&2
  exit 1
fi

cleanup() {
  kill "${ngrok_pid:-}" "${vite_pid:-}" 2>/dev/null || true
  wait "${ngrok_pid:-}" "${vite_pid:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

VITE_ALLOW_NGROK=1 npm run dev -- --host 0.0.0.0 > /tmp/hoppy-block-vite.log 2>&1 &
vite_pid=$!
for _ in {1..40}; do
  if curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then break; fi
  if ! kill -0 "$vite_pid" 2>/dev/null; then cat /tmp/hoppy-block-vite.log >&2; exit 1; fi
  sleep 0.25
done
if ! curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then
  cat /tmp/hoppy-block-vite.log >&2
  exit 1
fi

ngrok http 5173 --log=stdout > /tmp/hoppy-block-ngrok.log 2>&1 &
ngrok_pid=$!
for _ in {1..40}; do
  url=$(python3 - <<'PY' 2>/dev/null || true
import json, urllib.request
with urllib.request.urlopen('http://127.0.0.1:4040/api/tunnels', timeout=1) as response:
    print(next((t['public_url'] for t in json.load(response)['tunnels'] if t['public_url'].startswith('https://')), ''))
PY
)
  if [[ -n "$url" ]]; then
    echo "Share Hoppy Block: $url"
    echo 'Press Ctrl+C to stop sharing.'
    wait "$ngrok_pid"
    exit $?
  fi
  if ! kill -0 "$ngrok_pid" 2>/dev/null; then cat /tmp/hoppy-block-ngrok.log >&2; exit 1; fi
  sleep 0.5
done
cat /tmp/hoppy-block-ngrok.log >&2
exit 1
