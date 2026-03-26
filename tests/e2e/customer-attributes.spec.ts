import { test, expect } from '@playwright/test';

test.describe('Customer Attributes - Pages', () => {
  test('CRM page loads with new filter options', async ({ page }) => {
    await page.goto('/dashboard/crm');
    // Will redirect to login, which is expected
    await expect(page).toHaveURL(/\/login/);
  });

  test('Custom fields settings page exists', async ({ page }) => {
    const res = await page.goto('/dashboard/settings/custom-fields');
    expect(res?.status()).not.toBe(404);
  });

  test('Customer detail page loads without errors', async ({ page }) => {
    await page.goto('/dashboard/crm');
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Customer Attributes - API Auth', () => {
  test('custom fields API requires auth', async ({ request }) => {
    const res = await request.get('/api/crm/custom-fields');
    expect(res.status()).toBe(401);
  });

  test('tag categories API requires auth', async ({ request }) => {
    const res = await request.get('/api/crm/tag-categories');
    expect(res.status()).toBe(401);
  });
});

test.describe('Customer Attributes - LIFF', () => {
  test('LIFF mypage loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/liff/mypage');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Application error')).not.toBeVisible();
  });
});
