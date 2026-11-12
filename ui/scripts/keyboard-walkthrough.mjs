// Keyboard-only walkthrough of "Acting as", add person, add duty and rename in a real browser.
// Only page.keyboard (Tab, Shift+Tab, Enter, Space, Escape and typing) is used: no click(), no fill().
// Run against a FRESH mock and the app (`npm run start:with-mock`), then `npm run walkthrough`.
// Needs playwright-core (not a dependency of this repo): see scripts/a11y-browser.mjs for PLAYWRIGHT_CORE_DIR / BROWSER_PATH.
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE_DIR ??
    join(tmpdir(), 'pw-scratch', 'node_modules', 'playwright-core'),
);
const base = process.env.APP_URL ?? 'http://localhost:4200';
const executablePath =
  process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const browser = await chromium.launch({ executablePath, headless: true });
for (const event of ['uncaughtException', 'unhandledRejection']) {
  process.on(event, async (error) => {
    console.error(error);
    await browser.close().catch(() => {});
    process.exit(1);
  });
}
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(e.message));
const writes = [];
page.on(
  'request',
  (r) =>
    ['POST', 'PUT'].includes(r.method()) &&
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`),
);

let failures = 0;
const steps = [];
const check = (ok, text) => {
  steps.push(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  console.log(steps.at(-1));
  if (!ok) failures += 1;
};
const press = (key) => page.keyboard.press(key);
const focused = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    const clone = el?.cloneNode(true);
    clone?.querySelectorAll?.('mat-icon').forEach((icon) => icon.remove());
    const text = (el?.getAttribute('aria-label') || clone?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      tag: el?.tagName.toLowerCase() ?? 'none',
      text,
      id: el?.id ?? '',
      ariaDisabled: el?.getAttribute('aria-disabled'),
    };
  });

/** Presses a key until the focused element's text matches; returns how many presses it took. */
async function reach(label, pattern, key = 'Tab', max = 30) {
  for (let presses = 1; presses <= max; presses += 1) {
    await press(key);
    const now = await focused();
    if (pattern.test(`${now.tag} ${now.text}`)) {
      check(true, `${key} x${presses} reaches "${label}"`);
      return presses;
    }
  }
  check(false, `${key} never reached "${label}"`);
  throw new Error(`Could not reach ${label}`);
}
const settle = () => page.waitForTimeout(500);
/** Waits (up to 3 s) for focus to land inside a container; dialogs move focus after their opening animation. */
const focusInside = (selector) =>
  page
    .waitForFunction((s) => document.querySelector(s)?.contains(document.activeElement), selector, {
      timeout: 3000,
    })
    .then(
      () => true,
      () => false,
    );
const headingFocused = async (text) => {
  await page
    .waitForFunction(
      (t) =>
        document.activeElement?.tagName === 'H1' && document.activeElement.textContent.includes(t),
      text,
      { timeout: 4000 },
    )
    .catch(() => {});
  const now = await focused();
  check(
    now.tag === 'h1' && now.text.includes(text),
    `focus is on the page heading "${text}" (got ${now.tag} "${now.text}")`,
  );
};

await page.goto(`${base}/people`);
await page.waitForSelector('.card');

// 0. First Tab stop is the skip link; Enter moves focus into the main landmark.
await press('Tab');
let now = await focused();
check(now.text === 'Skip to content', 'the first Tab stop is the skip link');
await press('Enter');
now = await focused();
check(now.tag === 'main', 'Enter on the skip link moves focus to <main>');

// 1. Without an actor name the write controls are announced as blocked and do nothing.
await reach('Add person (people page)', /^button Add person/);
now = await focused();
check(now.ariaDisabled === 'true', 'Add person is aria-disabled while no name is set');
await press('Enter');
await press('Space');
await settle();
check(
  (await page.locator('app-add-person-dialog').count()) === 0 && writes.length === 0,
  'Enter and Space on the blocked button open nothing and send no request',
);

// 2. Acting as: Shift+Tab back to the toolbar button, Enter, type the name, Enter to save.
await reach('Acting as button', /^button Set your name/, 'Shift+Tab');
await press('Enter');
await page.waitForSelector('app-actor-dialog');
await focusInside('app-actor-dialog');
now = await focused();
check(now.tag === 'input', 'the Acting as dialog puts focus in the name field');
await page.keyboard.type('Ada Lovelace');
await press('Enter');
await page.waitForSelector('app-actor-dialog', { state: 'detached' });
await settle();
now = await focused();
check(
  now.text.startsWith('Acting as Ada Lovelace'),
  `focus returns to the toolbar button, now "${now.text}"`,
);

// 3. Add person.
await reach('Add person', /^button Add person/);
now = await focused();
check(now.ariaDisabled !== 'true', 'Add person is enabled once a name is set');
await press('Enter');
await page.waitForSelector('app-add-person-dialog');
await focusInside('app-add-person-dialog');
now = await focused();
check(
  now.tag === 'input' &&
    /Name/.test(await page.locator('app-add-person-dialog label').first().textContent()),
  'the dialog puts focus in the Name field',
);
await press('Enter');
await settle();
check(
  (await page.locator('app-add-person-dialog mat-error').first().textContent())?.includes(
    'required',
  ),
  'Enter on an empty name shows the required error (and stays open)',
);
await page.keyboard.type('Walter Keys');
await press('Escape');
await settle();
check(
  (await page.locator('app-add-person-dialog').count()) === 1 &&
    (await page.locator('.acts-discard-hint').count()) === 1,
  'Escape with typed text keeps the dialog open and explains how to discard',
);
await press('Enter');
await page.waitForURL(/\/people\/Walter%20Keys$/);
await settle();
await headingFocused('Walter Keys');
check(writes.includes('POST /Person'), 'POST /Person was sent');

// 4. Add duty (opened with Space; Escape on the pristine form closes it and returns focus).
await reach('Add duty', /^button Add duty/);
await press('Space');
await page.waitForSelector('form[aria-label="Add duty"]');
await focusInside('form[aria-label="Add duty"]');
now = await focused();
check(now.tag === 'input', 'the Add duty form puts focus in the Rank field');
await press('Escape');
await settle();
now = await focused();
check(
  (await page.locator('form[aria-label="Add duty"]').count()) === 0 &&
    now.text.startsWith('Add duty'),
  'Escape on an untouched form closes it and returns focus to the Add duty button',
);
await press('Enter');
await page.waitForSelector('form[aria-label="Add duty"]');
await focusInside('form[aria-label="Add duty"]');
await page.keyboard.type('CPT');
await press('Tab');
await page.keyboard.type('Pilot');
await press('Tab'); // RETIRED quick pick
await press('Tab'); // start date (defaults to today)
await press('Tab'); // reason
await page.keyboard.type('First assignment');
await press('Tab');
now = await focused();
check(
  now.tag === 'button' && now.text.includes('Add duty'),
  'Tab from the reason reaches the Add duty submit button',
);
await press('Enter');
await page.waitForSelector('form[aria-label="Add duty"]', { state: 'detached' });
await settle();
now = await focused();
check(now.text.startsWith('Add duty'), 'after saving, focus returns to the Add duty button');
check(
  (await page.locator('ol.timeline > li').count()) === 1 &&
    (await page.locator('ol.timeline').textContent()).includes('Pilot'),
  'the timeline shows the new Pilot duty',
);
check(writes.includes('POST /AstronautDuty'), 'POST /AstronautDuty was sent');

// 5. Rename (Shift+Tab from Add duty reaches Rename).
await reach('Rename', /^button Rename/, 'Shift+Tab');
await press('Enter');
await page.waitForSelector('form[aria-label="Rename person"]');
await focusInside('form[aria-label="Rename person"]');
now = await focused();
check(now.tag === 'input', 'the Rename form puts focus in the (selected) name field');
await page.keyboard.type('Walter Keyes');
await press('Enter');
await page.waitForURL(/\/people\/Walter%20Keyes$/);
await settle();
await headingFocused('Walter Keyes');
check(
  writes.some((w) => w.startsWith('PUT /Person/')),
  'PUT /Person/{name} was sent',
);

// 6. Back to People, then the new person is in the list.
await reach('Back to People', /^a Back to People/, 'Shift+Tab');
await press('Enter');
await page.waitForSelector('.card');
check(
  (await page.locator('.card .name', { hasText: 'Walter Keyes' }).count()) === 1,
  'the renamed person is in the list',
);

check(consoleErrors.length === 0, `no console errors (${consoleErrors.join(' | ') || 'none'})`);
await browser.close();
console.log(
  failures === 0
    ? '\nKeyboard-only walkthrough: all steps passed.'
    : `\n${failures} step(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
