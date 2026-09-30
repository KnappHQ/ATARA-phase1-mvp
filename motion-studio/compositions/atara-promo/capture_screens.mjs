#!/usr/bin/env node
// Captures the real ATARA simulation screens (preview/) as phone textures.
//   node compositions/atara-promo/capture_screens.mjs
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const preview = resolve(here, '../../../preview/index.html');
const out = resolve(here, 'assets/screens');
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(preview).href);
  const set = (sel, value) => page.evaluate(([s, v]) => {
    const el = document.querySelector(s);
    if (!el) throw new Error(`missing ${s}`);
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [sel, value]);

  // Copy edits for the story: a friend's handle and round amounts. The UI itself is untouched.
  await page.evaluate(() => show('send', false));
  await set('#recipient', '@lea');
  await set('#sendAmount', '25');
  await page.evaluate(() => show('pay', false));
  await set('#pay input[inputmode="decimal"]', '18,40');

  for (const id of ['home', 'pay', 'send', 'card', 'security']) {
    await page.evaluate((i) => { show(i, false); document.activeElement?.blur(); }, id);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${id}.png` });
    console.log('captured', id);
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
