// Maintainer helper. Needs a local Chrome and `playwright-core` resolvable
// (e.g. NODE_PATH=/path/to/node_modules node scripts/capture-screenshots.mjs).
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const outDir = path.resolve('docs/screenshots');
const base = process.env.CMO_SCREENSHOT_URL ?? 'https://peterway202410.github.io/cmo-health/';

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'welcome.png'), fullPage: true });

await page.evaluate(() => {
  const profile = {
    birth_date: '1990-06-15',
    gender: 'male',
    height_cm: 175,
    has_hypertension: false,
    has_diabetes: false,
    has_hypercholesterolemia: false,
    has_hyperuricemia: false,
    has_fatty_liver: false,
    has_carotid_plaque: false,
    has_stroke_history: false,
    has_family_metabolic_history: false,
    activity: 'light',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };
  localStorage.setItem('cmo:profile', JSON.stringify(profile));
});
await page.goto(`${base}#/pages/home/home`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'home.png'), fullPage: true });

await page.goto(`${base}#/pages/my/my`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(outDir, 'my.png'), fullPage: true });

await browser.close();
console.log(`saved screenshots to ${outDir}`);
