// Runs axe-core (all rules, including color-contrast) against the running app in a real browser, at desktop and
// phone width, and exits 1 when there is a serious or critical violation.
//
//   npm run start:mock        (terminal 1)
//   npm run start:app         (terminal 2)
//   npm run a11y:browser      (terminal 3)
//
// playwright-core is NOT a dependency of this repo. Point PLAYWRIGHT_CORE_DIR at an install of it, and BROWSER_PATH
// at a Chromium-based browser (defaults: %TEMP%/pw-scratch/node_modules/playwright-core and Edge on Windows).
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const playwrightDir =
  process.env.PLAYWRIGHT_CORE_DIR ??
  join(tmpdir(), 'pw-scratch', 'node_modules', 'playwright-core');
const { chromium } = require(playwrightDir);
const axeSource = require.resolve('axe-core/axe.min.js');
const base = process.env.APP_URL ?? 'http://localhost:4200';
const executablePath =
  process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const widths = [1280, 360];
const scenarios = [
  { name: 'people list', path: '/people', ready: '.card' },
  { name: 'person detail', path: '/people/John%20Doe', ready: 'ol.timeline' },
  {
    name: 'person detail, no actor name',
    path: '/people/Jane%20Roe',
    ready: 'ol.timeline',
    actor: null,
  },
  {
    name: 'rename form',
    path: '/people/John%20Doe',
    ready: 'ol.timeline',
    act: async (page) => page.getByRole('button', { name: 'Rename' }).click(),
    after: 'form[aria-label="Rename person"]',
  },
  {
    name: 'add duty form',
    path: '/people/John%20Doe',
    ready: 'ol.timeline',
    act: async (page) => page.getByRole('button', { name: 'Add duty' }).click(),
    after: 'form[aria-label="Add duty"]',
  },
  {
    name: 'add duty form with reason banner and errors',
    path: '/people/John%20Doe',
    ready: 'ol.timeline',
    act: async (page) => {
      await page.getByRole('button', { name: 'Add duty' }).click();
      await page.fill('input[type="date"]', '2018-01-01');
      await page.locator('form[aria-label="Add duty"] button[type="submit"]').click();
    },
    after: '.banner',
  },
  {
    name: 'add person dialog',
    path: '/people',
    ready: '.card',
    act: async (page) => page.getByRole('button', { name: 'Add person' }).first().click(),
    after: 'app-add-person-dialog',
  },
  {
    name: 'Acting as dialog',
    path: '/people',
    ready: '.card',
    act: async (page) => page.locator('app-acting-as button').click(),
    after: 'app-actor-dialog',
  },
  { name: '404 page', path: '/nowhere', ready: 'app-state-notice' },
];

const browser = await chromium.launch({ executablePath, headless: true });
let blocking = 0;
for (const width of widths) {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    if (scenario.actor !== null) {
      await context.addInitScript(() => localStorage.setItem('acts.actor', 'Ada Lovelace'));
    }
    const page = await context.newPage();
    await page.goto(base + scenario.path);
    await page.waitForSelector(scenario.ready);
    if (scenario.act) {
      await scenario.act(page);
      await page.waitForSelector(scenario.after);
    }
    await page.waitForTimeout(600); // page and dialog animations
    await page.addScriptTag({ path: axeSource });
    const results = await page.evaluate(() =>
      globalThis.axe.run(document, { resultTypes: ['violations'] }),
    );
    const violations = results.violations;
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    blocking += bad.length;
    console.log(
      `${width}px  ${scenario.name}: ${violations.length} violation(s), ${bad.length} serious/critical`,
    );
    for (const v of violations) {
      console.log(`    [${v.impact}] ${v.id}: ${v.help}`);
      for (const node of v.nodes.slice(0, 4)) {
        console.log(
          `        ${node.target.join(' ')}  ${(node.any[0]?.message ?? node.failureSummary ?? '').split('\n')[0]}`,
        );
      }
    }
    await context.close();
  }
}
await browser.close();
console.log(
  blocking === 0
    ? 'No serious or critical violations.'
    : `${blocking} serious/critical violation(s).`,
);
process.exit(blocking === 0 ? 0 : 1);
