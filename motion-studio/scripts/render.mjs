#!/usr/bin/env node
// Frame-exact renderer: steps an HTML composition through time in headless
// Chromium, screenshots every frame and pipes the PNGs into ffmpeg.
//
// A composition exposes `window.composition = { width, height, fps, duration, seek(t) }`.
// seek(t) draws the whole frame for t seconds and never reads the clock. CSS
// animations and Web Animations on the page are paused and scrubbed to t too.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const USAGE = `usage: node scripts/render.mjs <composition.html> [options]

  -o, --out <file>     output video (default: out/<name>.mp4)
  --fps <n>            override the composition's fps
  --duration <s>       override the composition's duration
  --width <px>         override the viewport width (use vw units to scale)
  --height <px>        override the viewport height
  --audio <file>       mux this audio track into the video
  --cues <file.json>   expose JSON to the page as window.cues (see analyze_audio.py)
  --still <s>          write a single PNG at <s> seconds instead of a video
  --no-sheet           skip the contact sheet written next to the video`;

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', short: 'o' },
    fps: { type: 'string' },
    duration: { type: 'string' },
    width: { type: 'string' },
    height: { type: 'string' },
    audio: { type: 'string' },
    cues: { type: 'string' },
    still: { type: 'string' },
    'no-sheet': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (opts.help || positionals.length !== 1) {
  console.log(USAGE);
  process.exit(opts.help ? 0 : 1);
}

const input = resolve(positionals[0]);
const name = basename(input) === 'index.html' ? basename(dirname(input)) : basename(input, extname(input));

// Containers that ship a preinstalled Chromium (Claude Code on the web sets
// PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers) may not have the exact browser
// build this Playwright version expects, so fall back to that binary.
async function launchChromium() {
  if (process.env.CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    return await chromium.launch();
  } catch (err) {
    const preinstalled = '/opt/pw-browsers/chromium';
    if (existsSync(preinstalled)) return chromium.launch({ executablePath: preinstalled });
    throw err;
  }
}

function positive(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be a positive number, got ${value}`);
  return n;
}

function ffmpeg(args) {
  const child = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  child.stdin.on('error', () => {}); // an early exit surfaces through `done`
  const done = new Promise((res, rej) => {
    child.on('error', rej);
    child.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited with code ${code}`))));
  });
  return { stdin: child.stdin, done };
}

async function contactSheet(video, frames, out) {
  const cols = 4;
  const rows = 3;
  const step = Math.max(1, Math.floor(frames / (cols * rows)));
  const { stdin, done } = ffmpeg([
    '-i', video,
    '-vf', `select='not(mod(n\\,${step}))',scale=480:-2,tile=${cols}x${rows}`,
    '-frames:v', '1', out,
  ]);
  stdin.end();
  await done;
}

const browser = await launchChromium();
try {
  const page = await browser.newPage();
  if (opts.cues) {
    const cues = JSON.parse(readFileSync(opts.cues, 'utf8'));
    await page.addInitScript((data) => { window.cues = data; }, cues);
  }
  await page.goto(pathToFileURL(input).href, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.composition?.seek === 'function', null, { timeout: 10_000 });
  const meta = await page.evaluate(() => {
    const { width, height, fps, duration } = window.composition;
    return { width, height, fps, duration };
  });

  const width = positive(opts.width ?? meta.width ?? 1920, 'width');
  const height = positive(opts.height ?? meta.height ?? 1080, 'height');
  const fps = positive(opts.fps ?? meta.fps ?? 30, 'fps');
  const duration = positive(opts.duration ?? meta.duration, 'duration');
  if (width % 2 || height % 2) throw new Error(`H.264 needs even dimensions, got ${width}x${height}`);

  await page.setViewportSize({ width, height });
  await page.evaluate(() => document.fonts.ready);

  const seek = (t) => page.evaluate(async (t) => {
    await window.composition.seek(t);
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = t * 1000;
    }
  }, t);

  mkdirSync('out', { recursive: true });

  if (opts.still !== undefined) {
    const t = Number(opts.still);
    if (!(t >= 0)) throw new Error(`--still must be a time in seconds, got ${opts.still}`);
    const out = opts.out ?? `out/${name}@${t}s.png`;
    mkdirSync(dirname(resolve(out)), { recursive: true });
    await seek(t);
    writeFileSync(out, await page.screenshot({ type: 'png' }));
    console.log(`still ${t}s → ${out}`);
  } else {
    const out = opts.out ?? `out/${name}.mp4`;
    mkdirSync(dirname(resolve(out)), { recursive: true });
    const frames = Math.round(duration * fps);
    const args = ['-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
    if (opts.audio) args.push('-i', opts.audio);
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p');
    if (opts.audio) args.push('-c:a', 'aac', '-b:a', '192k');
    args.push('-t', String(frames / fps), '-movflags', '+faststart', out);
    const encoder = ffmpeg(args);

    const started = Date.now();
    for (let i = 0; i < frames; i++) {
      await seek(i / fps);
      const png = await page.screenshot({ type: 'png' });
      if (!encoder.stdin.write(png)) await Promise.race([once(encoder.stdin, 'drain'), encoder.done]);
      if (process.stderr.isTTY) process.stderr.write(`\rframe ${i + 1}/${frames}`);
    }
    encoder.stdin.end();
    await encoder.done;
    if (process.stderr.isTTY) process.stderr.write('\n');
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${frames} frames @ ${fps} fps, ${width}x${height} → ${out} (${seconds}s)`);

    if (!opts['no-sheet']) {
      const sheet = out.replace(/\.[^./]+$/, '') + '.sheet.jpg';
      await contactSheet(out, frames, sheet);
      console.log(`contact sheet → ${sheet}`);
    }
  }
} finally {
  await browser.close();
}
