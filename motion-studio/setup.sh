#!/usr/bin/env bash
# Sets up motion-studio on macOS (Homebrew) or Debian/Ubuntu (apt). Safe to re-run.
#
#   ./setup.sh               everything
#   ./setup.sh --no-skills   skip the Remotion + HyperFrames skills (route B)
#   ./setup.sh --no-plugin   skip the hand-drawn claude-animation plugin (route C)
set -euo pipefail
cd "$(dirname "$0")"

with_skills=1
with_plugin=1
for arg in "$@"; do
  case "$arg" in
    --no-skills) with_skills=0 ;;
    --no-plugin) with_plugin=0 ;;
    -h|--help) sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

pkg_install() {
  if have brew; then
    brew install "$@"
  elif have apt-get; then
    local sudo=""
    [ "$(id -u)" -eq 0 ] || sudo="sudo"
    $sudo apt-get update -qq
    $sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  else
    echo "Neither Homebrew nor apt-get found. Install these yourself, then re-run: $*" >&2
    exit 1
  fi
}

step "1/4 Runtime: Node 22+, ffmpeg, Python audio analysis"
if ! have node && have brew; then brew install node; fi
node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$node_major" -lt 22 ]; then
  echo "Node 22+ is required (found $(node -v 2>/dev/null || echo none)). Install it with nvm, fnm or https://nodejs.org." >&2
  exit 1
fi
have ffmpeg || pkg_install ffmpeg
if ! have python3; then
  if have brew; then pkg_install python; else pkg_install python3; fi
fi
# A virtualenv, because Homebrew and Ubuntu 24.04 refuse system-wide pip installs (PEP 668).
if [ ! -x .venv/bin/pip ]; then
  if ! python3 -m venv --clear .venv; then
    have apt-get || exit 1
    pkg_install python3-venv
    python3 -m venv --clear .venv
  fi
fi
.venv/bin/pip install --quiet --disable-pip-version-check -r requirements.txt

step "2/4 Node dependencies and headless Chromium"
npm ci --no-audit --no-fund
if [ "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" = "1" ] || [ -x /opt/pw-browsers/chromium ]; then
  echo "Using the preinstalled Chromium (scripts/render.mjs falls back to /opt/pw-browsers/chromium)."
else
  npx playwright install chromium
fi

if [ "$with_skills" = 1 ]; then
  step "3/4 Framework skills: Remotion + HyperFrames into .claude/skills/"
  for pkg in remotion-dev/skills heygen-com/hyperframes; do
    npx -y skills add "$pkg" --skill '*' --agent claude-code --copy -y
  done
else
  step "3/4 Framework skills: skipped"
fi

if [ "$with_plugin" = 1 ]; then
  step "4/4 Hand-drawn look: claude-animation plugin"
  if have claude; then
    claude plugin marketplace add buildwithhanif/claude-animation-skill --scope project
    claude plugin install claude-animation@claude-animation-skill --scope project
    # The plugin's renderer needs @napi-rs/canvas installed next to its skill.
    for dir in "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/claude-animation-skill/claude-animation/*/skills/claude-animation; do
      if [ -f "$dir/package.json" ]; then (cd "$dir" && npm install --no-audit --no-fund); fi
    done
  else
    echo "Claude Code CLI not found. Opening Claude Code in this folder offers the plugin from .claude/settings.json."
  fi
else
  step "4/4 Hand-drawn look: skipped"
fi

step "Done"
cat <<'EOF'
Check the toolchain:  npm run smoke
Start Claude Code:    claude                  (run it from motion-studio/: Opus 5.5 at xhigh effort)
Flagship pieces:      claude --effort max
EOF
