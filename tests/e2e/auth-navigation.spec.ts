import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('E2E-001: redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('E2E-002: login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('管理画面ログイン');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('E2E-003: shows error on invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Wait for error message
    await expect(page.locator('[class*="bg-red"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Navigation', () => {
  // Since we can't actually authenticate in E2E without Supabase,
  // test the login page and public pages

  test('E2E-004: home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LineMag/);
  });

  test('E2E-005: login page has LineMag branding', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=LineMag')).toBeVisible();
  });
});

test.describe('LIFF Pages', () => {
  test('E2E-006: LIFF booking page loads', async ({ page }) => {
    await page.goto('/liff/booking');
    await expect(page.locator('text=相談種別')).toBeVisible();
  });

  test('E2E-007: LIFF booking step 1 shows service types', async ({ page }) => {
    await page.goto('/liff/booking');
    await expect(page.locator('text=一般相談')).toBeVisible();
    await expect(page.locator('text=技術相談')).toBeVisible();
    await expect(page.locator('text=キャリア相談')).toBeVisible();
  });

  test('E2E-008: LIFF booking proceeds to step 2 on selection', async ({ page }) => {
    await page.goto('/liff/booking');
    await page.click('text=一般相談');
    await expect(page.locator('text=日付を選択')).toBeVisible({ timeout: 5000 });
  });

  test('E2E-009: LIFF coupons page loads', async ({ page }) => {
    await page.goto('/liff/coupons');
    await expect(page.locator('text=マイクーポン')).toBeVisible();
  });

  test('E2E-010: LIFF mypage loads', async ({ page }) => {
    await page.goto('/liff/mypage');
    await expect(page.locator('text=マイページ')).toBeVisible();
  });

  test('E2E-011: LIFF mypage has navigation links', async ({ page }) => {
    await page.goto('/liff/mypage');
    await expect(page.locator('text=予約する')).toBeVisible();
    await expect(page.locator('text=マイクーポン')).toBeVisible();
  });
});
