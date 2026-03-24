import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('E2E-090: 404 page for non-existent routes', async ({ page }) => {
    const response = await page.goto('/nonexistent-page');
    expect(response?.status()).toBe(404);
  });

  test('E2E-091: API returns 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/crm/customers');
    expect(response.status()).toBe(401);
  });

  test('E2E-092: API returns 401 for coupon endpoints', async ({ request }) => {
    const response = await request.get('/api/coupons');
    expect(response.status()).toBe(401);
  });

  test('E2E-093: API returns 401 for booking endpoints', async ({ request }) => {
    const response = await request.get('/api/booking/slots');
    expect(response.status()).toBe(401);
  });

  test('E2E-094: API returns 401 for MA endpoints', async ({ request }) => {
    const response = await request.get('/api/ma/scenarios');
    expect(response.status()).toBe(401);
  });

  test('E2E-095: API returns 401 for analytics endpoints', async ({ request }) => {
    const response = await request.get('/api/analytics/kpi?from=2026-01-01&to=2026-03-25');
    expect(response.status()).toBe(401);
  });

  test('E2E-096: Webhook endpoint is public (no 401)', async ({ request }) => {
    const response = await request.post('/api/line/webhook', {
      data: { events: [] },
    });
    expect(response.status()).toBe(200);
  });

  test('E2E-097: Cron endpoint requires auth', async ({ request }) => {
    const response = await request.get('/api/cron/line-broadcast');
    expect(response.status()).toBe(401);
  });

  test('E2E-098: Cron with valid secret proceeds', async ({ request }) => {
    const response = await request.get('/api/cron/line-broadcast', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    // Won't be 401 — will be 200 or 500 depending on config
    expect(response.status()).not.toBe(401);
  });

  test('E2E-099: LIFF pages handle missing API gracefully', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/liff/booking');
    await page.waitForTimeout(2000);

    // Should render without crashing even if API is unavailable
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('API Response Format', () => {
  test('E2E-100: webhook returns proper JSON', async ({ request }) => {
    const response = await request.post('/api/line/webhook', {
      data: { events: [] },
    });
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });
});
