#!/usr/bin/env node
// Web/Brand QA lane: screenshot homepage + sign-in across desktop/mobile light/dark
// and dump computed fonts to JSON.

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('docs/evidence/2026-05-18-continued-claude-testing/web-electron');
const BASE = process.env.LAYERS_BASE_URL || 'http://localhost:3000';

const ROUTES = [
  { name: 'home', url: '/' },
  { name: 'signin', url: '/sign-in' },
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];
const THEMES = ['light', 'dark'];

const SELECTORS = ['body', 'h1', 'h2', 'p', 'a', 'button'];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      colorScheme: theme,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();

    for (const route of ROUTES) {
      const tag = `${route.name}-${vp.name}-${theme}`;
      const url = `${BASE}${route.url}`;
      let status = 0;
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        status = resp ? resp.status() : 0;
      } catch (e) {
        results.push({ tag, url, status, error: String(e?.message || e) });
        continue;
      }
      // Force theme via prefers-color-scheme as well as the .light class the site uses.
      await page.evaluate((t) => {
        const html = document.documentElement;
        html.classList.remove('light', 'dark');
        html.classList.add(t);
        html.style.colorScheme = t;
      }, theme);
      await page.waitForTimeout(400);

      const screenshotPath = path.join(OUT, `${tag}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      const fonts = await page.evaluate((sels) => {
        const dump = {};
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (!el) {
            dump[sel] = null;
            continue;
          }
          const cs = window.getComputedStyle(el);
          dump[sel] = {
            fontFamily: cs.fontFamily,
            fontWeight: cs.fontWeight,
            fontSize: cs.fontSize,
          };
        }
        return dump;
      }, SELECTORS);

      const serifViolations = Object.entries(fonts).filter(([, v]) => {
        if (!v) return false;
        const ff = (v.fontFamily || '').toLowerCase();
        // sans-serif is the generic family token "sans-serif"; we treat real
        // serif families (Times, Georgia, Cambria, etc.) or a bare "serif"
        // token (i.e. not preceded by "sans-") as a violation.
        if (/(times|georgia|cambria|garamond|baskerville|charter|didot)/.test(ff)) return true;
        // bare "serif" not preceded by "sans-" or "ui-"
        return /(^|[^-])serif/.test(ff.replace(/sans-serif/g, '').replace(/ui-serif/g, ''));
      });

      results.push({
        tag,
        url,
        status,
        screenshot: path.relative(process.cwd(), screenshotPath),
        fonts,
        serifViolations: serifViolations.map(([k]) => k),
      });
    }

    await ctx.close();
  }
}

await browser.close();

const summary = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  results,
  totals: {
    runs: results.length,
    withSerifViolations: results.filter((r) => r.serifViolations && r.serifViolations.length > 0).length,
    nonOk: results.filter((r) => r.status !== 200).length,
  },
};

await writeFile(path.join(OUT, 'web-font-audit.json'), JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary.totals, null, 2));
for (const r of results) {
  console.log(`${r.tag.padEnd(28)} ${r.status} violations=${(r.serifViolations || []).join(',') || 'none'}`);
}
