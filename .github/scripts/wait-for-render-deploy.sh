#!/usr/bin/env bash
# Waits until the API reports the expected commit in /health/backend.
#
# Usage: wait-for-render-deploy.sh <health-url> <expected-sha> [timeout-s] [interval-s]
#
# Render redeploys on every push to the deploy branch, but a failed build or
# `prisma migrate deploy` leaves the previous version serving with no signal
# anywhere in GitHub. This makes that failure visible.
set -euo pipefail

url="$1"
expected="$2"
timeout="${3:-1200}"
interval="${4:-30}"
short="${expected:0:12}"
deadline=$(( $(date +%s) + timeout ))
served="unreachable"

while :; do
  if body=$(curl -fsS --max-time 15 "$url" 2>/dev/null); then
    served=$(printf '%s' "$body" | jq -r '.commit // "none"')
    if [ "$served" = "$short" ]; then
      echo "Render serves ${served} ($(printf '%s' "$body" | jq -r '.network // "unknown network"'))."
      if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
        echo "Render serves \`${served}\`, the commit merged to main." >> "$GITHUB_STEP_SUMMARY"
      fi
      exit 0
    fi
  else
    served="unreachable"
  fi

  if [ "$(date +%s)" -ge "$deadline" ]; then
    message="Render still serves ${served}, expected ${short}. Check the Render dashboard: did the build or prisma migrate deploy fail?"
    echo "::error::${message}"
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
      echo "$message" >> "$GITHUB_STEP_SUMMARY"
    fi
    exit 1
  fi

  echo "Serving ${served}, waiting for ${short}…"
  sleep "$interval"
done
