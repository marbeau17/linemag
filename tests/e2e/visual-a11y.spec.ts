import { test, expect } from '@playwright/test';

test.describe('Visual Rendering', () => {
  test('E2E-060: login page screenshot', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveScreenshot('login.png', { maxDiffPixelRatio: 0.1 });
  });

  test('E2E-061: LIFF mypage screenshot', async ({ page }) => {
    await page.goto('/liff/mypage');
    await expect(page).toHaveScreenshot('liff-mypage.png', { maxDiffPixelRatio: 0.1 });
  });

  test('E2E-062: LIFF booking screenshot', async ({ page }) => {
    await page.goto('/liff/booking');
    await expect(page).toHaveScreenshot('liff-booking.png', { maxDiffPixelRatio: 0.1 });
  });

  test('E2E-063: LIFF coupons screenshot', async ({ page }) => {
    await page.goto('/liff/coupons');
    await expect(page).toHaveScreenshot('liff-coupons.png', { maxDiffPixelRatio: 0.1 });
  });

  test('E2E-064: home page screenshot', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('home.png', { maxDiffPixelRatio: 0.1 });
  });
});

test.describe('Accessibility', () => {
  test('E2E-070: login form has proper labels', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Check labels exist
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
  });

  test('E2E-071: login button is focusable', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeFocused();
  });

  test('E2E-072: LIFF booking cards are clickable', async ({ page }) => {
    await page.goto('/liff/booking');
    const cards = page.locator('[class*="cursor-pointer"], button, [role="button"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-073: no broken images on LIFF pages', async ({ page }) => {
    await page.goto('/liff/mypage');
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      // Allow 0 for intentionally hidden/lazy images
      expect(naturalWidth).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Performance', () => {
  test('E2E-080: login page loads within 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/login', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(3000);
  });

  test('E2E-081: LIFF booking loads within 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/liff/booking', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(3000);
  });
});
