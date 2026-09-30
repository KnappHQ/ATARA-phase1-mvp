#!/usr/bin/env node
// Renders several stills of one composition in a single browser session.
//   node scripts/stills.mjs compositions/x/index.html out/x 1.5 5.5 12   → out/x/t01.50.png …
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const [file, dir, ...times] = process.argv.slice(2);
if (!file || !dir || !times.length) { console.error('usage: stills.mjs <composition.html> <outdir> <t>...'); process.exit(1); }
const width = Number(process.env.W ?? 1920), height = Number(process.env.H ?? 1080);
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.composition?.seek === 'function');
  for (const t of times) {
    await page.evaluate(async (t) => { await window.composition.seek(t); for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; } }, Number(t));
    const out = `${dir}/t${Number(t).toFixed(2).padStart(5, '0')}.png`;
    writeFileSync(out, await page.screenshot({ type: 'png' }));
    console.log(out);
  }
  if (errors.length) { console.error('PAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exitCode = 2; }
} finally { await browser.close(); }
