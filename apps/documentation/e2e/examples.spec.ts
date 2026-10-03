/**
 * The example apps: the gallery lists them, and an app's page shows its own code.
 */
import { expect, test } from '@playwright/test';

test('the gallery lists the wallet and links to its page', async ({ page }) => {
  await page.goto('/examples');
  const card = page.locator('[data-example="wallet"]');
  await expect(card).toContainText('Wallet');
  await expect(card).toContainText('Forms');

  await card.click();
  await expect(page).toHaveURL(/\/examples\/wallet$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wallet');
});

test("an app's page shows its code, and opens another file", async ({ page }) => {
  await page.goto('/examples/wallet');
  const code = page.locator('example-code-browser .shiki');
  await expect(page.locator('[data-file]')).toHaveText('src/app/home/home.solid.tsx');
  await expect(code).toContainText('Ada Lovelace');

  await page
    .getByRole('navigation', { name: 'Files' })
    .getByRole('button', { name: 'send.solid.tsx' })
    .click();
  await expect(page.locator('[data-file]')).toHaveText('src/app/send/send.solid.tsx');
  await expect(code).toContainText('createForm');
});
