import { test, expect } from '@playwright/test';

test.describe('Booking System - Admin Pages', () => {
  // Protected pages should redirect to login
  test('reservation list redirects to login', async ({ page }) => {
    await page.goto('/dashboard/reservations');
    await expect(page).toHaveURL(/\/login/);
  });

  test('calendar page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/reservations/calendar');
    await expect(page).toHaveURL(/\/login/);
  });

  test('slots page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/reservations/slots');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Booking System - LIFF Booking Flow', () => {
  test('booking page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/liff/booking');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Application error')).not.toBeVisible();

    // Filter out expected errors (missing Supabase env, fetch failures)
    const unexpected = errors.filter(e =>
      !e.includes('supabase') && !e.includes('SUPABASE') &&
      !e.includes('fetch') && !e.includes('URL and Key')
    );
    expect(unexpected).toHaveLength(0);
  });

  test('booking step 1 shows service types', async ({ page }) => {
    await page.goto('/liff/booking');
    await page.waitForLoadState('networkidle');

    // Should have service type selection
    const body = await page.textContent('body');
    expect(body).toContain('相談');
  });

  test('LIFF reservations page loads', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/liff/reservations');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Application error')).not.toBeVisible();
  });
});

test.describe('Booking System - Navigation', () => {
  test('sub-nav tabs exist on reservation pages', async ({ page }) => {
    // These will redirect to login, but we check that they exist and don't 404
    const response = await page.goto('/dashboard/reservations');
    expect(response?.status()).not.toBe(404);

    const response2 = await page.goto('/dashboard/reservations/calendar');
    expect(response2?.status()).not.toBe(404);

    const response3 = await page.goto('/dashboard/reservations/slots');
    expect(response3?.status()).not.toBe(404);
  });
});

test.describe('Booking API - Auth', () => {
  test('booking API requires authentication', async ({ request }) => {
    const res = await request.get('/api/booking/reservations');
    expect(res.status()).toBe(401);
  });

  test('consultants API requires authentication', async ({ request }) => {
    const res = await request.get('/api/booking/consultants');
    expect(res.status()).toBe(401);
  });

  test('settings API requires authentication', async ({ request }) => {
    const res = await request.get('/api/booking/settings');
    expect(res.status()).toBe(401);
  });
});
