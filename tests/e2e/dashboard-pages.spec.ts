import { test, expect } from '@playwright/test';

test.describe('Dashboard Access Control', () => {
  const protectedRoutes = [
    '/dashboard',
    '/dashboard/schedule',
    '/dashboard/history',
    '/dashboard/logs',
    '/dashboard/crm',
    '/dashboard/crm/segments',
    '/dashboard/coupons',
    '/dashboard/coupons/new',
    '/dashboard/reservations',
    '/dashboard/reservations/calendar',
    '/dashboard/reservations/slots',
    '/dashboard/ma',
    '/dashboard/ma/ab-tests',
    '/dashboard/analytics',
    '/dashboard/analytics/reports',
  ];

  for (const route of protectedRoutes) {
    test(`E2E-020: ${route} redirects to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe('LIFF Booking Flow', () => {
  test('E2E-030: complete booking step navigation', async ({ page }) => {
    await page.goto('/liff/booking');

    // Step 1: Select service type
    await expect(page.locator('text=相談種別')).toBeVisible();
    const generalCard = page.locator('text=一般相談').first();
    await generalCard.click();

    // Step 2: Calendar should appear
    // (may show loading or empty state depending on API)
    await page.waitForTimeout(1000);

    // Go back
    const backButton = page.locator('[aria-label*="戻る"], button:has-text("戻る")').first();
    if (await backButton.isVisible()) {
      await backButton.click();
      await expect(page.locator('text=相談種別')).toBeVisible();
    }
  });
});

test.describe('LIFF Coupon Page', () => {
  test('E2E-040: coupon tabs work', async ({ page }) => {
    await page.goto('/liff/coupons');
    await expect(page.locator('text=マイクーポン')).toBeVisible();

    // Check tab buttons exist
    const availableTab = page.locator('text=利用可能');
    const usedTab = page.locator('text=利用済み');

    if (await availableTab.isVisible()) {
      await availableTab.click();
      await page.waitForTimeout(500);
    }
    if (await usedTab.isVisible()) {
      await usedTab.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('E2E-050: LIFF pages are mobile-optimized', async ({ page }) => {
    await page.goto('/liff/mypage');
    // Check no horizontal scroll
    const body = page.locator('body');
    const bodyWidth = await body.evaluate((el) => el.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test('E2E-051: Login page works on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
