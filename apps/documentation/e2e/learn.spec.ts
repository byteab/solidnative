/**
 * The course, driven as a learner drives it: edit the code, watch the phone and the checks.
 */
import { expect, test, type Page } from '@playwright/test';

/** Replace the file on screen with `text`, as one edit. */
async function write(page: Page, text: string): Promise<void> {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(text);
}

/** The file on screen, as the editor has it. */
function source(page: Page): Promise<string> {
  return page
    .locator('.cm-line')
    .allTextContents()
    .then((lines) => lines.join('\n'));
}

const phone = (page: Page) => page.frameLocator('iframe[title="Preview"]');
/** `data-run-count` on `learn-lesson-preview`'s own host: see that component for why. */
const preview = (page: Page) => page.locator('learn-lesson-preview');

/** The current `data-run-count`, to pass to `waitForRunAfter` once an edit is made. */
function runCount(page: Page): Promise<string> {
  return preview(page)
    .getAttribute('data-run-count')
    .then((value) => value ?? '0');
}

/** Waits for a run past `before`, so a caller can be sure an edit's rerun has actually landed on
 *  the phone rather than guessing how long the debounce and the round trip to the frame take. */
async function waitForRunAfter(page: Page, before: string): Promise<void> {
  await expect(preview(page)).not.toHaveAttribute('data-run-count', before);
}

async function open(page: Page, slug: string): Promise<void> {
  await page.goto(`/learn/${slug}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // The checks run after the first good run, so once one is listed the app is on the phone. The
  // first run downloads and compiles the whole preview, and on a busy machine Firefox can take
  // longer than the default wait over it.
  await expect(page.locator('[data-check]').first()).toBeVisible({ timeout: 30_000 });
}

/** Go to a step and put its solution in place, as the button in the editor's toolbar does. */
async function solve(page: Page, step: number): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^Step ${step}:`) }).click();
  await page.getByRole('button', { name: `Solve step ${step}` }).click();
}

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept());
});

test('the course page lists the lessons in order', async ({ page }) => {
  await page.goto('/learn');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Build a habit tracker');
  const lessons = page.locator('ol > li h2');
  await expect(lessons).toHaveText([
    'Your first screen',
    'Layout and style',
    'A list of habits',
    'Touch',
    'Tailwind and platforms',
    'A form for new habits',
    'Testing',
  ]);
  await page.getByRole('link', { name: /Your first screen/ }).click();
  await expect(page).toHaveURL(/\/learn\/first-screen$/);
});

test('an edit reaches the phone and passes the step, and is still there after a reload', async ({
  page,
}) => {
  await open(page, 'first-screen');
  await expect(phone(page).getByText('Hello')).toBeVisible();
  await expect(page.locator('[data-check="fail"]')).toHaveText('The screen says Today');

  await write(page, (await source(page)).replace('Hello', 'Today'));

  await expect(phone(page).getByText('Today')).toBeVisible();
  await expect(page.locator('[data-check="pass"]')).toHaveText('The screen says Today');
  await expect(page.getByRole('button', { name: /^Step 1:/ })).toHaveClass(/bg-emerald-600/);

  await page.reload();
  await expect(phone(page).getByText('Today')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Step 1:/ })).toHaveClass(/bg-emerald-600/);
});

test('a syntax error is shown over the last app that worked, with its line', async ({ page }) => {
  await open(page, 'first-screen');
  await write(page, (await source(page)).replace('</Text>', '</View>'));

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Syntax error');
  await expect(alert).toContainText('Expected corresponding JSX closing tag for <Text>');
  await expect(alert.getByRole('button', { name: 'app.tsx:9' })).toBeVisible();
  // The last good app is still on the phone behind it.
  await expect(phone(page).getByText('Hello')).toBeVisible();
  await expect(alert).toContainText('last version that ran');
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);
});

test('a loop that never ends is stopped, and the page keeps working', async ({ page }) => {
  await open(page, 'state-and-components');
  // `solve` triggers a run of its own; waited for here so it cannot land after the count below is
  // read and be mistaken for the rerun the edit further down causes.
  const beforeSolve = await runCount(page);
  await solve(page, 3);
  await waitForRunAfter(page, beforeSolve);
  await page.getByRole('tab', { name: 'app.tsx' }).click();
  const before = await runCount(page);
  await write(
    page,
    (await source(page)).replace(
      'onToggle={() => toggle(habit.id)}',
      'onToggle={() => {\n              while (true) {}\n            }}',
    ),
  );
  // The rerun waits for typing to stop; the new app has to be the one pressed.
  await waitForRunAfter(page, before);
  await phone(page).getByText('Drink water').click();
  await expect(page.getByRole('alert')).toContainText('A loop ran for more than 2 seconds');
  await page.getByRole('tab', { name: 'habit-row.tsx' }).click();
  await expect(page.locator('.cm-content')).toContainText('export function HabitRow');
});

test('Android reloads the phone, and X-ray names the native views', async ({ page }) => {
  await open(page, 'first-screen');
  await page.getByRole('button', { name: 'Android' }).click();
  await expect(page.getByRole('button', { name: 'Android' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(phone(page).getByText('Hello')).toBeVisible();
  await page.getByRole('button', { name: 'X-ray' }).click();
  await expect(phone(page).locator('.xray-box span', { hasText: 'text Paragraph' })).toBeVisible();
  await expect(phone(page).locator('html')).toHaveClass(/platform-android/);
});

test('a finished lesson stays finished on Android', async ({ page }) => {
  await open(page, 'tailwind-and-platforms');
  await solve(page, 4);
  await page.getByRole('button', { name: 'Android' }).click();
  await expect(phone(page).locator('html')).toHaveClass(/platform-android/);
  const title = phone(page).getByText('Today');
  // android:font-medium, where iOS has font-bold.
  await expect(title).toHaveCSS('font-weight', '500');
  for (const step of [1, 2, 3, 4]) {
    await page.getByRole('button', { name: new RegExp(`^Step ${step}:`) }).click();
    await expect(page.locator('[data-check="pass"]').first()).toBeVisible();
    await expect(page.locator('[data-check="fail"]')).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: /^Step 1:/ })).toHaveClass(/bg-emerald-600/);
});

test('CSS a device build would refuse is reported as the build would', async ({ page }) => {
  await open(page, 'layout-and-style');
  await page.getByRole('tab', { name: 'app.native.css' }).click();
  await write(page, (await source(page)).replace('flex: 1;', 'flex: 1;\n  display: grid;'));
  const notes = page.getByRole('list', { name: 'Notes' });
  await expect(notes).toContainText('Native build');
  await expect(notes).toContainText('display: grid does not exist on native');
});

test('the native CSS compiler downloads only once a stylesheet changes', async ({ page }) => {
  const wasm: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.wasm')) wasm.push(request.url());
  });
  await open(page, 'first-screen');
  await expect(phone(page).getByText('Hello')).toBeVisible();
  // The run (or runs - loading the frame can itself cause a second one) a fresh lesson makes
  // before any edit, waited for by its own count rather than a guess at how long it takes, so a
  // download the edit below triggers is never counted against it.
  await expect(preview(page)).not.toHaveAttribute('data-run-count', '0');
  expect(wasm).toEqual([]);

  await page.getByRole('tab', { name: 'app.native.css' }).click();
  await write(page, (await source(page)).replace('flex: 1;', 'flex: 1;\n  display: grid;'));
  await expect(page.getByRole('list', { name: 'Notes' })).toContainText(
    'display: grid does not exist on native',
  );
  expect(wasm).toHaveLength(1);
});

test('an element no component claims is reported as a device would', async ({ page }) => {
  await open(page, 'first-screen');
  await write(
    page,
    (await source(page)).replace('<Text>Hello</Text>', '<Text>Hello</Text>\n      <txt />'),
  );
  await expect(page.getByRole('list', { name: 'Notes' })).toContainText(
    '<txt> is not a known element',
  );
});

test("the learner's tests run in the page", async ({ page }) => {
  await open(page, 'testing');
  await solve(page, 3);
  await page.getByRole('button', { name: 'Run tests' }).click();
  const results = page.getByRole('region', { name: 'Test results' });
  await expect(results).toContainText('4 of 4 tests passed');
  await expect(page.locator('[data-check="pass"]')).toHaveCount(1);
  await expect(page.locator('[data-check="fail"]')).toHaveCount(0);
});

test('Tailwind styles the phone, and dark mode follows the phone', async ({ page }) => {
  await open(page, 'tailwind-and-platforms');
  await solve(page, 4);
  const title = phone(page).getByText('Today');
  await expect(title).toHaveCSS('font-weight', '700');
  await expect(title).toHaveCSS('color', /rgb\(24, 24, 27\)|oklch/);
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(title).toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('the solution button solves the step it is on and no further', async ({ page }) => {
  await open(page, 'first-screen');
  await page.getByRole('button', { name: 'Solve step 1' }).click();
  await expect(phone(page).getByText('Today')).toBeVisible();
  await expect(page.locator('[data-check="pass"]')).toHaveText('The screen says Today');
  await expect(page.getByRole('button', { name: /^Step 1:/ })).toHaveClass(/bg-emerald-600/);
  expect(await source(page)).not.toContain('left to do');

  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('[data-check="fail"]')).toHaveText('A second line says 3 left to do');
  await expect(page.getByRole('button', { name: /^Step 2:/ })).not.toHaveClass(/bg-emerald-600/);
  await expect(page.getByRole('button', { name: 'Solve step 2' })).toBeVisible();
});

test('Reset puts the starter back', async ({ page }) => {
  await open(page, 'first-screen');
  await write(page, (await source(page)).replace('Hello', 'Changed'));
  await expect(phone(page).getByText('Changed')).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(phone(page).getByText('Hello')).toBeVisible();
  expect(await source(page)).toContain('<Text>Hello</Text>');
});

test('a file can be added, is kept, and can be removed', async ({ page }) => {
  await open(page, 'a-form-for-new-habits');
  await page.getByRole('button', { name: 'New file' }).click();
  const name = page.getByRole('textbox', { name: 'New file name' });
  await name.fill('NewHabit');
  await name.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Use lower case letters');
  await name.fill('new-habit');
  await name.press('Enter');
  const tab = page.getByRole('tab', { name: 'new-habit.tsx' });
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await write(page, "export const greeting = 'Hello';");

  await page.reload();
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.locator('.cm-content')).toContainText("export const greeting = 'Hello';");

  await page.getByRole('button', { name: 'Remove new-habit.tsx' }).click();
  await expect(tab).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'app.tsx' })).toHaveAttribute('aria-selected', 'true');
});

test('the form adds a habit from the Add button and the return key', async ({ page }) => {
  await open(page, 'a-form-for-new-habits');
  await solve(page, 3);
  const field = phone(page).getByPlaceholder('New habit');
  await expect(field).toBeVisible();

  await phone(page).getByText('Add', { exact: true }).click();
  await expect(phone(page).getByText('Give the habit a name')).toBeVisible();

  await field.fill('Stretch');
  await phone(page).getByText('Add', { exact: true }).click();
  await expect(phone(page).getByText('Stretch')).toBeVisible();
  await expect(field).toHaveValue('');
  await expect(phone(page).getByText('Give the habit a name')).toHaveCount(0);

  await field.fill('Meditate');
  await field.press('Enter');
  await expect(phone(page).getByText('Meditate')).toBeVisible();

  // Every one of step 3's five checks passes against its solution.
  await expect(page.locator('[data-check="pass"]')).toHaveCount(5);
});

test("the learner's code runs in an opaque origin, away from the site's cookies and storage", async ({
  page,
}) => {
  await open(page, 'first-screen');
  await page.evaluate(() => {
    document.cookie = 'secret=course';
    localStorage.setItem('secret', 'course');
  });
  await write(
    page,
    [
      "import { Text, View } from '@solidnative/components/solid';",
      '',
      'function attempt(read: () => unknown): string {',
      '  try {',
      "    return String(read() || 'nothing');",
      '  } catch {',
      "    return 'blocked';",
      '  }',
      '}',
      '',
      'export function App() {',
      '  return (',
      '    <View>',
      '      <Text>{`cookie ${attempt(() => document.cookie)}`}</Text>',
      "      <Text>{`storage ${attempt(() => localStorage.getItem('secret'))}`}</Text>",
      '      <Text>{`page ${attempt(() => parent.document.title)}`}</Text>',
      '      <Text>{`origin ${self.origin}`}</Text>',
      '    </View>',
      '  );',
      '}',
    ].join('\n'),
  );

  for (const line of ['cookie blocked', 'storage blocked', 'page blocked', 'origin null']) {
    await expect(phone(page).getByText(line, { exact: true })).toBeVisible();
  }
  // Still there to take, had the frame shared the site's origin.
  expect(await page.evaluate(() => document.cookie)).toContain('secret=course');
});

test('the lesson page takes messages from its own preview frame and nothing else', async ({
  page,
}) => {
  await open(page, 'first-screen');
  const said = (message: string) => ({ type: 'problem', problem: { kind: 'console', message } });

  // The lesson page itself, at the site's origin, and another sandboxed frame, whose origin is
  // 'null' just as the preview's is.
  await page.evaluate((message) => window.postMessage(message, '*'), said('From the page'));
  await page.evaluate(async (message) => {
    const frame = document.createElement('iframe');
    frame.sandbox.add('allow-scripts');
    frame.srcdoc = `<script>parent.postMessage(${JSON.stringify(message)}, '*')</script>`;
    const loaded = new Promise((resolve) => frame.addEventListener('load', resolve));
    document.body.append(frame);
    await loaded;
  }, said('From another frame'));

  // The preview frame, saying the same, is heard.
  const preview = page.frames().find((frame) => frame.url().includes('/learn-preview.html'));
  await preview!.evaluate(
    (message) => parent.postMessage(message, location.origin),
    said('From the preview'),
  );
  const notes = page.getByRole('list', { name: 'Notes' });
  await expect(notes).toContainText('From the preview');
  await expect(notes).not.toContainText('From the page');
  await expect(notes).not.toContainText('From another frame');
});
