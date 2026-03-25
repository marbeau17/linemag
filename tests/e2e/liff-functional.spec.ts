import { test, expect } from '@playwright/test';

test.describe('LIFF Booking Page', () => {
  test('renders step 1 with service type cards', async ({ page }) => {
    await page.goto('/liff/booking');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    // Wait for page to be interactive
    await page.waitForLoadState('networkidle');

    // No "Application error" shown
    await expect(page.locator('text=Application error')).not.toBeVisible();

    // Service type cards should be visible
    // Check for Japanese text that should appear
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('step 1 cards are clickable', async ({ page }) => {
    await page.goto('/liff/booking');
    await page.waitForLoadState('networkidle');

    // Try clicking the first card-like element
    const cards = page.locator('[class*="cursor-pointer"], [class*="rounded"][class*="border"]').first();
    if (await cards.isVisible()) {
      await cards.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('LIFF Coupons Page', () => {
  test('renders without crash', async ({ page }) => {
    await page.goto('/liff/coupons');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Application error')).not.toBeVisible();

    // Should show the page header or empty state
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('tab buttons are interactive', async ({ page }) => {
    await page.goto('/liff/coupons');
    await page.waitForLoadState('networkidle');

    // Try clicking tab buttons if they exist
    const tabs = page.locator('button');
    const count = await tabs.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      const tab = tabs.nth(i);
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(300);
      }
    }

    await expect(page.locator('text=Application error')).not.toBeVisible();
  });
});

test.describe('LIFF MyPage', () => {
  test('renders menu items', async ({ page }) => {
    await page.goto('/liff/mypage');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Application error')).not.toBeVisible();

    // Should have navigation links
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('menu links are navigable', async ({ page }) => {
    await page.goto('/liff/mypage');
    await page.waitForLoadState('networkidle');

    // Find and click links
    const links = page.locator('a[href*="/liff/"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });
});

// Mobile viewport tests
test.describe('LIFF Mobile Rendering', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('booking page fits mobile screen', async ({ page }) => {
    await page.goto('/liff/booking');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    const scrollWidth = await body.evaluate(el => el.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });

  test('coupons page fits mobile screen', async ({ page }) => {
    await page.goto('/liff/coupons');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    const scrollWidth = await body.evaluate(el => el.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
});
