import { expect, test, type Page } from '@playwright/test';

const ACTOR = 'E2E Tester';

/** Collects what a human would see in the browser console and any failed API call. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.method()} ${r.url()}`));
  return problems;
}

async function setActor(page: Page) {
  await page.getByRole('button', { name: /Set your name/ }).click();
  await page.getByRole('textbox', { name: 'Your name' }).fill(ACTOR);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`Acting as ${ACTOR}`) })).toBeVisible();
}

test('add a person, add a duty and see it on the timeline (real API, no mock)', async ({
  page,
}) => {
  const problems = watch(page);
  const writes: string[] = [];
  page.on('response', (r) => {
    if (['POST', 'PUT'].includes(r.request().method())) {
      writes.push(`${r.request().method()} ${new URL(r.url()).origin} ${r.status()}`);
    }
  });
  const name = `E2E Person ${Date.now()}`;

  await page.goto('/people');
  await expect(page.locator('.card').first()).toBeVisible();
  await setActor(page);

  await page.getByRole('button', { name: 'Add person' }).first().click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Add person' }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${encodeURIComponent(name)}$`));
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  await page.getByRole('button', { name: 'Add duty' }).first().click();
  const form = page.getByRole('form', { name: 'Add duty' });
  await form.getByRole('textbox', { name: 'Rank' }).fill('CPT');
  await form.getByRole('textbox', { name: 'Duty title' }).fill('Pilot');
  await form.getByRole('button', { name: 'Add duty' }).click();

  const timeline = page.locator('ol.timeline > li');
  await expect(timeline).toHaveCount(1);
  await expect(timeline.first()).toContainText('Pilot');
  await expect(timeline.first()).toContainText('CPT');

  // The writes really went to the API on 5204 (the mock listens on 3000) and nothing logged an error.
  expect(writes).toEqual(['POST http://localhost:5204 201', 'POST http://localhost:5204 201']);
  expect(problems).toEqual([]);
});

test('a duplicate name shows the API conflict message, not a connection error', async ({
  page,
}) => {
  const problems = watch(page);
  await page.goto('/people');
  await expect(page.locator('.card').first()).toBeVisible();
  await setActor(page);

  await page.getByRole('button', { name: 'Add person' }).first().click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name' }).fill('jack rourke');
  await page.getByRole('dialog').getByRole('button', { name: 'Add person' }).click();

  await expect(page.getByRole('dialog')).toContainText(/already exists/i);
  await expect(page.getByRole('dialog')).not.toContainText(/unreachable|CORS/i);
  // The browser logs the 409 itself as a console error; anything else would be a real problem.
  expect(problems.filter((p) => !p.includes('409'))).toEqual([]);
});
