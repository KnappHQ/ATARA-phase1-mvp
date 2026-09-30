# motion-studio

Motion design workspace for ATARA videos: promos, feature reveals, social cuts. Nothing here ships in the
mobile app, the API or the contracts. Renders go to `out/` (gitignored); never commit them.

## Pick a route

- **A. HTML composition + `render.mjs`** (default for short brand pieces): write
  `compositions/<name>/index.html`, render with `npm run render -- compositions/<name>/index.html`.
- **B. Framework skills** in `.claude/skills/` (installed by `./setup.sh`): `/remotion-create`,
  `/remotion-render` for React/Remotion; `/hyperframes` for HTML + GSAP (it routes to motion-graphics,
  product-launch-video, music-to-video, pr-to-video…).
- **C. Hand-drawn look**: the `claude-animation` plugin (node canvas rigs, pens, synthesized sound).

## Composition contract (route A)

- Expose `window.composition = { width, height, fps, duration, seek(t) }`. `seek(t)` sets the whole frame
  for `t` seconds. Never read the clock (`Date.now`, `performance.now`, timers) inside it: the renderer
  steps time itself, and every frame must be reproducible.
- CSS animations and the Web Animations API are paused and scrubbed to `t` automatically. Build GSAP
  timelines paused and call `tl.seek(t)` from `seek`.
- Size everything from the viewport width (see the `--u` unit in `compositions/hello`), so
  `--width/--height` preview renders show the same frame.
- Keep fonts, images and audio next to the composition and load them by relative path. Bundle fonts with
  `@font-face`: system fonts differ between machines.
- Beat sync: `.venv/bin/python scripts/analyze_audio.py track.wav` writes `out/track.cues.json`;
  `--cues out/track.cues.json` exposes it as `window.cues` (`tempo`, `beats`, `onsets`, `energy[frame]`).

## Check your work

- Look at pixels before calling it done: `--still <t>` renders one PNG, and every render writes a contact
  sheet next to the video (`out/<name>.sheet.jpg`). A render that exits 0 proves nothing about the picture.
- `npm run smoke` checks the whole toolchain (ffmpeg, librosa, Playwright, encode) end to end.
- Brand: black background, text `#f6f5f4`, muted `#929292`, green accent `#4ade80`, wordmark at weight 650
  with wide tracking. Sources: `frontend/tailwind.config.js`, `preview/style.css`.
