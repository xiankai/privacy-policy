import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const GENERATOR_URL = 'https://app-privacy-policy-generator.nisrulz.com/';
const PLATFORMS = ['android', 'ios', 'kaios', 'windows', 'web'];
const MAX_STEPS = 12;

const slug = process.argv[2];
if (!slug) {
  console.error('usage: node tools/generate.mjs <app-slug>');
  process.exit(64);
}
const appDir = join(import.meta.dirname, '..', 'apps', slug);
const { generator: input } = JSON.parse(await readFile(join(appDir, 'app.json'), 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage({ serviceWorkers: 'block' });

const visible = async (locator) => (await locator.count()) > 0 && locator.first().isVisible();

const fillIfShown = async (role, name, value) => {
  const field = page.getByRole(role, { name, exact: true });
  if (value !== undefined && (await visible(field))) await field.first().fill(String(value));
};

const checkRadioIfShown = async (name) => {
  const radio = page.getByRole('radio', { name, exact: true });
  if (await visible(radio)) await radio.first().check();
};

const setChecked = async (id, want) => {
  const checked = () => page.evaluate((i) => document.getElementById(i).checked, id);
  if ((await checked()) !== want) {
    const label = page.locator(`label[for="${id}"]`);
    const target = (await label.count()) ? label.first() : page.locator(`[id="${id}"]`).locator('xpath=..');
    await target.waitFor({ state: 'visible' });
    await page.waitForTimeout(700);
    await target.click();
    await page.waitForTimeout(300);
  }
  if ((await checked()) !== want) throw new Error(`could not set ${id} to ${want}`);
};

const shownCheckboxIds = () => page.evaluate(() =>
  [...document.querySelectorAll('main input[type=checkbox]')]
    .filter((box) => box.id && (box.getClientRects().length || box.parentElement.getClientRects().length))
    .map((box) => box.id));

const wantedCheckboxes = {
  locationcheckbox: input.location,
  aicheckbox: input.ai,
  datadeletioncheckbox: input.dataDeletion,
  ...Object.fromEntries(PLATFORMS.map((platform) => [`platform-${platform}`, input.platforms.includes(platform)])),
  ...Object.fromEntries(input.thirdParties.map((service) => [`list-switch-${service}`, true])),
};
const servicesSet = new Set();

const fillStep = async () => {
  await fillIfShown('textbox', 'App Name', input.appName);
  await fillIfShown('textbox', 'Contact Information', input.contact);
  await fillIfShown('textbox', 'Policy Effective Date', input.effectiveDate);
  await fillIfShown('textbox', 'Personally Identifiable Information', input.pii ?? '');
  await fillIfShown('spinbutton', 'Age of Digital Consent', input.consentAge);
  await fillIfShown('textbox', 'Developer Name', input.developerName);
  await checkRadioIfShown(input.appType);
  await checkRadioIfShown(input.ownerType);
  for (const id of await shownCheckboxIds()) {
    if (!(id in wantedCheckboxes)) continue;
    await setChecked(id, wantedCheckboxes[id]);
    if (id.startsWith('list-switch-') && wantedCheckboxes[id]) servicesSet.add(id);
  }
};

const grab = async (label) => {
  await page.locator('#step-8').getByText(label, { exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'HTML' }).filter({ visible: true }).first().click();
  await page.waitForTimeout(300);
  const value = await page.locator('textarea').filter({ visible: true }).first().inputValue();
  await page.getByRole('button', { name: 'close' }).filter({ visible: true }).first().click();
  return value;
};

try {
  await page.goto(GENERATOR_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('radio', { name: input.template, exact: true }).check();

  for (let step = 1; !(await visible(page.locator('#step-8'))); step += 1) {
    if (step > MAX_STEPS) throw new Error('wizard did not reach the document step');
    await fillStep();
    await page.getByText('Next', { exact: true }).filter({ visible: true }).click({ timeout: 10000 });
    await page.waitForTimeout(400);
  }

  const missing = input.thirdParties.filter((service) => !servicesSet.has(`list-switch-${service}`));
  if (missing.length) throw new Error(`third-party services the generator does not offer: ${missing.join(', ')}`);

  const privacy = await grab('Privacy Policy');
  const terms = await grab('Terms & Conditions');

  await mkdir(join(appDir, 'generated'), { recursive: true });
  await writeFile(join(appDir, 'generated', 'privacy.html'), privacy);
  await writeFile(join(appDir, 'generated', 'terms.html'), terms);
  console.log(`wrote apps/${slug}/generated/{privacy,terms}.html`);
} catch (error) {
  await page.screenshot({ path: join(appDir, 'generate-failure.png') });
  throw error;
} finally {
  await browser.close();
}
