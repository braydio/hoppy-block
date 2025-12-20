#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
INTERVAL="${INTERVAL:-10}"
PULL_MODE="${PULL_MODE:-rebase}" # "rebase" or "merge"
COMMIT_MSG="${COMMIT_MSG:-}"

if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "Branch '$BRANCH' does not exist locally."
  exit 1
fi

if ! git config --get user.name >/dev/null || ! git config --get user.email >/dev/null; then
  echo "Git user.name and user.email must be set to auto-commit."
  exit 1
fi

commit_if_dirty() {
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    if ! git diff --cached --quiet; then
      local msg
      if [ -n "$COMMIT_MSG" ]; then
        msg="$COMMIT_MSG"
      else
        msg="chore: auto-sync $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      fi
      git commit -m "$msg"
    fi
  fi
}

pull_updates() {
  if [ "$PULL_MODE" = "merge" ]; then
    git pull "$REMOTE" "$BRANCH"
  else
    git pull --rebase "$REMOTE" "$BRANCH"
  fi
}

DEV_CMD="${DEV_CMD:-npm run dev}"
DEV_LOG="${DEV_LOG:-logs/dev-server.log}"

mkdir -p "$(dirname "$DEV_LOG")"

cleanup() {
  if [ -n "${DEV_PID:-}" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID"
    wait "$DEV_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting dev server: $DEV_CMD"
nohup bash -lc "$DEV_CMD" >>"$DEV_LOG" 2>&1 &
DEV_PID=$!

echo "Watching '$BRANCH' (remote '$REMOTE') every ${INTERVAL}s. Pull mode: $PULL_MODE."

while true; do
  if ! git fetch "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
    echo "Fetch failed; retrying in ${INTERVAL}s."
    sleep "$INTERVAL"
    continue
  fi

  local_sha="$(git rev-parse "$BRANCH")"
  remote_sha="$(git rev-parse "$REMOTE/$BRANCH")"

  if [ -n "$(git status --porcelain)" ] || [ "$local_sha" != "$remote_sha" ]; then
    commit_if_dirty
    if [ "$local_sha" != "$remote_sha" ]; then
      if ! pull_updates; then
        echo "Pull failed; resolve conflicts and rerun."
        exit 1
      fi
    fi

    if [ "$(git rev-list --count "$REMOTE/$BRANCH..$BRANCH")" -gt 0 ]; then
      git push "$REMOTE" "$BRANCH"
    fi
  fi

  sleep "$INTERVAL"
done
