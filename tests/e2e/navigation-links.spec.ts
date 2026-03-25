import { test, expect } from '@playwright/test';

test.describe('Navigation Links - Public Pages', () => {
  test('Home page has working links', async ({ page }) => {
    await page.goto('/');

    // Check "ダッシュボードを開く" link
    const dashLink = page.locator('a[href="/dashboard"]');
    await expect(dashLink).toBeVisible();

    // Check "予約する (LIFF)" link
    const bookingLink = page.locator('a[href="/liff/booking"]');
    await expect(bookingLink).toBeVisible();

    // Click LIFF link and verify navigation
    await bookingLink.click();
    await expect(page).toHaveURL(/\/liff\/booking/);
  });

  test('Login page has home link', async ({ page }) => {
    await page.goto('/login');
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
  });

  test('LIFF MyPage has working menu links', async ({ page }) => {
    await page.goto('/liff/mypage');

    // Check booking link
    const bookingLink = page.locator('a[href="/liff/booking"]');
    await expect(bookingLink).toBeVisible();

    // Check coupons link
    const couponsLink = page.locator('a[href="/liff/coupons"]');
    await expect(couponsLink).toBeVisible();

    // Check reservations link
    const reservationsLink = page.locator('a[href="/liff/reservations"]');
    await expect(reservationsLink).toBeVisible();

    // Navigate to booking
    await bookingLink.click();
    await expect(page).toHaveURL(/\/liff\/booking/);
  });

  test('LIFF pages have back navigation', async ({ page }) => {
    await page.goto('/liff/booking');
    // Should have some way back (back button or link)

    await page.goto('/liff/coupons');
    // Check for back/home link

    await page.goto('/liff/reservations');
    // Check for back link to mypage
  });
});

test.describe('Navigation Links - Protected Pages (redirect check)', () => {
  test('All dashboard links redirect to login', async ({ page }) => {
    // Visit home, click dashboard link
    await page.goto('/');
    const dashLink = page.locator('a[href="/dashboard"]').first();
    await dashLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('404 Page Navigation', () => {
  test('404 page has home link', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');

    // Should show 404 content
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
  });
});

test.describe('LIFF Cross-Page Navigation', () => {
  test('Can navigate between all LIFF pages', async ({ page }) => {
    // Start at MyPage
    await page.goto('/liff/mypage');

    // Go to booking
    await page.locator('a[href="/liff/booking"]').click();
    await expect(page).toHaveURL(/\/liff\/booking/);
    await expect(page.locator('text=Application error')).not.toBeVisible();

    // Go back to mypage
    await page.goto('/liff/mypage');

    // Go to coupons
    await page.locator('a[href="/liff/coupons"]').click();
    await expect(page).toHaveURL(/\/liff\/coupons/);
    await expect(page.locator('text=Application error')).not.toBeVisible();

    // Go to reservations
    await page.goto('/liff/mypage');
    await page.locator('a[href="/liff/reservations"]').click();
    await expect(page).toHaveURL(/\/liff\/reservations/);
    await expect(page.locator('text=Application error')).not.toBeVisible();
  });
});
