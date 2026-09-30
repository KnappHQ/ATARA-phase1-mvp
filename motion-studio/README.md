# motion-studio

A workspace for making ATARA motion pieces with Claude Code: HTML compositions rendered frame-exact in
headless Chromium and encoded with ffmpeg, beat cues from librosa, plus optional Remotion, HyperFrames and
hand-drawn animation skills. It is independent of the app: its own `package.json`, no CI job, nothing
shipped.

## Setup

```bash
cd motion-studio
./setup.sh            # --no-skills / --no-plugin to skip the optional parts
npm run smoke         # renders a 4 s test clip to out/smoke/ and checks it
```

`setup.sh` is safe to re-run. It does the following:

1. **Runtime.** Checks for Node 22+, installs ffmpeg and Python with Homebrew or apt if they are missing,
   then installs `numpy librosa soundfile` into `.venv/`. It uses a virtualenv because Homebrew and
   Ubuntu 24.04 block system-wide `pip install`.
2. **Headless browser.** Runs `npm ci` (Playwright) and `npx playwright install chromium`. It skips the
   browser download in containers that already ship one at `/opt/pw-browsers`.
3. **Framework skills (route B).** Runs `npx skills add remotion-dev/skills` and
   `npx skills add heygen-com/hyperframes`, which copy 33 skills into `.claude/skills/`. They are
   gitignored (about 22 MB of third-party files), so run setup again to update them.
4. **Hand-drawn look (route C).** Adds the `buildwithhanif/claude-animation-skill` marketplace, installs
   `claude-animation` at project scope, and installs the plugin's `@napi-rs/canvas` dependency.

`.claude/settings.json` sets Claude Code to Opus 5.5 at `xhigh` effort and enables the plugin. Start
`claude` from inside `motion-studio/` so these settings and skills apply. Use `claude --effort max` for
flagship pieces.

## Render

```bash
npm run render -- compositions/hello/index.html                       # out/hello.mp4 + out/hello.sheet.jpg
npm run render -- compositions/hello/index.html --still 2.5           # one PNG at 2.5 s
npm run render -- compositions/hello/index.html --width 960 --height 540 --duration 2   # quick preview

.venv/bin/python scripts/analyze_audio.py track.wav                    # out/track.cues.json
npm run render -- compositions/hello/index.html --audio track.wav --cues out/track.cues.json
```

A composition is a single HTML page that exposes this object:

```js
window.composition = {
  width: 1920, height: 1080, fps: 30, duration: 4,
  seek(t) { /* draw the frame at t seconds, without reading the clock */ },
};
```

The renderer calls `seek` once per frame. It also pauses and scrubs any CSS animations and Web Animations
on the page, takes a screenshot, and pipes the frames to ffmpeg (H.264, yuv420p, CRF 18). Opened directly
in a browser, `compositions/hello` loops for preview. `CLAUDE.md` has the full contract and house rules.

## Layout

```
motion-studio/
├── compositions/hello/   sample ATARA title card (4 s, beat-reactive with --cues)
├── scripts/
│   ├── render.mjs        HTML → frames → MP4 / PNG + contact sheet
│   ├── analyze_audio.py  tempo, beats, onsets, per-frame energy → JSON
│   └── smoke.mjs         end-to-end toolchain check
├── .claude/settings.json model, effort, plugin
├── setup.sh              one-shot installer (macOS / Debian / Ubuntu)
└── out/                  renders (gitignored)
```
