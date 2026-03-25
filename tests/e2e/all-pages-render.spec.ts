import { test, expect } from '@playwright/test';

// All public pages (no auth required)
const publicPages = [
  { path: '/', name: 'Home' },
  { path: '/login', name: 'Login' },
  { path: '/liff/booking', name: 'LIFF Booking' },
  { path: '/liff/coupons', name: 'LIFF Coupons' },
  { path: '/liff/mypage', name: 'LIFF MyPage' },
];

// All dashboard pages (auth required - should redirect to /login)
const protectedPages = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/dashboard/schedule', name: 'Schedule' },
  { path: '/dashboard/history', name: 'History' },
  { path: '/dashboard/logs', name: 'Logs' },
  { path: '/dashboard/crm', name: 'CRM' },
  { path: '/dashboard/crm/segments', name: 'Segments' },
  { path: '/dashboard/coupons', name: 'Coupons' },
  { path: '/dashboard/coupons/new', name: 'New Coupon' },
  { path: '/dashboard/reservations', name: 'Reservations' },
  { path: '/dashboard/reservations/calendar', name: 'Calendar' },
  { path: '/dashboard/reservations/slots', name: 'Slots' },
  { path: '/dashboard/ma', name: 'MA' },
  { path: '/dashboard/ma/ab-tests', name: 'AB Tests' },
  { path: '/dashboard/analytics', name: 'Analytics' },
  { path: '/dashboard/analytics/delivery', name: 'Delivery Analytics' },
  { path: '/dashboard/analytics/customers', name: 'Customer Analytics' },
  { path: '/dashboard/analytics/coupons', name: 'Coupon Analytics' },
  { path: '/dashboard/analytics/bookings', name: 'Booking Analytics' },
  { path: '/dashboard/analytics/reports', name: 'Reports' },
];

test.describe('Public Pages Render', () => {
  for (const page of publicPages) {
    test(`${page.name} (${page.path}) renders without errors`, async ({ page: p }) => {
      const errors: string[] = [];
      p.on('pageerror', (err) => errors.push(err.message));

      await p.goto(page.path, { waitUntil: 'networkidle' });

      // Should not show "Application error" text
      const appError = await p.locator('text=Application error').count();
      expect(appError).toBe(0);

      // Should not have unhandled JS errors (excluding Supabase config errors)
      const criticalErrors = errors.filter(e =>
        !e.includes('supabase') && !e.includes('SUPABASE') &&
        !e.includes('Failed to fetch') && !e.includes('URL and Key')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});

test.describe('Protected Pages Redirect', () => {
  for (const page of protectedPages) {
    test(`${page.name} (${page.path}) redirects to login`, async ({ page: p }) => {
      const errors: string[] = [];
      p.on('pageerror', (err) => errors.push(err.message));

      await p.goto(page.path);

      // Should redirect to /login
      await expect(p).toHaveURL(/\/login/);

      // Login page should render without "Application error"
      const appError = await p.locator('text=Application error').count();
      expect(appError).toBe(0);
    });
  }
});
