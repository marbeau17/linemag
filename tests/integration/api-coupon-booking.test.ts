import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/coupon/masters', () => ({
  getCouponMasters: vi.fn(),
  createCouponMaster: vi.fn(),
  getCouponMasterById: vi.fn(),
  updateCouponMaster: vi.fn(),
  deleteCouponMaster: vi.fn(),
}));

vi.mock('@/lib/coupon/issues', () => ({
  batchIssueCoupon: vi.fn(),
  getCouponIssues: vi.fn(),
  getCustomerCoupons: vi.fn(),
  getCouponStats: vi.fn(),
}));

vi.mock('@/lib/booking/slots', () => ({
  getAvailableSlots: vi.fn(),
  bulkCreateSlots: vi.fn(),
  getBookingSettings: vi.fn(),
  updateBookingSettings: vi.fn(),
}));

vi.mock('@/lib/booking/reservations', () => ({
  getReservations: vi.fn(),
  createReservation: vi.fn(),
  getReservationById: vi.fn(),
  confirmReservation: vi.fn(),
  cancelReservation: vi.fn(),
  completeReservation: vi.fn(),
  markNoShow: vi.fn(),
  getReservationStats: vi.fn(),
}));

vi.mock('@/lib/booking/consultants', () => ({
  getConsultants: vi.fn(),
  createConsultant: vi.fn(),
  getConsultantById: vi.fn(),
}));

// Also mock the barrel re-export used by coupons/[id]/route.ts
vi.mock('@/lib/coupon', () => ({
  getCouponMasterById: vi.fn(),
  getCouponStats: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports – must come after vi.mock() calls
// ---------------------------------------------------------------------------

import { getCouponMasters, createCouponMaster } from '@/lib/coupon/masters';
import { batchIssueCoupon, getCustomerCoupons } from '@/lib/coupon/issues';
import { getCouponMasterById, getCouponStats } from '@/lib/coupon';
import { updateCouponMaster } from '@/lib/coupon/masters';
import {
  getAvailableSlots,
  bulkCreateSlots,
  getBookingSettings,
  updateBookingSettings,
} from '@/lib/booking/slots';
import { getConsultants, createConsultant, getConsultantById } from '@/lib/booking/consultants';
import {
  getReservations,
  createReservation,
  getReservationById,
  confirmReservation,
  getReservationStats,
} from '@/lib/booking/reservations';

// Route handlers
import { GET as couponsGET, POST as couponsPOST } from '@/app/api/coupons/route';
import {
  GET as couponByIdGET,
  PUT as couponByIdPUT,
} from '@/app/api/coupons/[id]/route';
import { POST as couponIssuePOST } from '@/app/api/coupons/[id]/issue/route';
import { GET as customerCouponsGET } from '@/app/api/coupons/customer/[customerId]/route';
import { GET as slotsGET, POST as slotsPOST } from '@/app/api/booking/slots/route';
import { GET as settingsGET, PUT as settingsPUT } from '@/app/api/booking/settings/route';
import {
  GET as consultantsGET,
  POST as consultantsPOST,
} from '@/app/api/booking/consultants/route';
import {
  GET as reservationsGET,
  POST as reservationsPOST,
} from '@/app/api/booking/reservations/route';
import { PUT as reservationByIdPUT } from '@/app/api/booking/reservations/[id]/route';
import { GET as reservationStatsGET } from '@/app/api/booking/reservations/stats/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

function routeParams<T extends Record<string, string>>(obj: T) {
  return { params: Promise.resolve(obj) };
}

// ---------------------------------------------------------------------------
// Tests — Coupon API
// ---------------------------------------------------------------------------

describe('Coupon API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. GET /api/coupons
  it('GET /api/coupons — returns coupon list', async () => {
    const mockCoupons = [
      { id: 'c1', name: '10% OFF' },
      { id: 'c2', name: '500円引き' },
    ];
    vi.mocked(getCouponMasters).mockResolvedValue(mockCoupons as any);

    const res = await couponsGET(createRequest('/api/coupons'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(mockCoupons);
    expect(getCouponMasters).toHaveBeenCalledWith({ activeOnly: false });
  });

  // 2. POST /api/coupons
  it('POST /api/coupons — creates coupon master', async () => {
    const input = { name: '新クーポン', discountType: 'percentage', discountValue: 10 };
    const created = { id: 'c3', ...input };
    vi.mocked(createCouponMaster).mockResolvedValue(created as any);

    const res = await couponsPOST(
      createRequest('/api/coupons', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(created);
    expect(createCouponMaster).toHaveBeenCalledWith(input);
  });

  // 3. GET /api/coupons/[id]
  it('GET /api/coupons/[id] — returns coupon with stats', async () => {
    const master = { id: 'c1', name: '10% OFF' };
    const stats = { issued: 100, used: 42 };
    vi.mocked(getCouponMasterById).mockResolvedValue(master as any);
    vi.mocked(getCouponStats).mockResolvedValue(stats as any);

    const res = await couponByIdGET(
      createRequest('/api/coupons/c1'),
      routeParams({ id: 'c1' }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ master, stats });
  });

  // 4. PUT /api/coupons/[id]
  it('PUT /api/coupons/[id] — updates coupon', async () => {
    const updated = { id: 'c1', name: 'Updated' };
    vi.mocked(updateCouponMaster).mockResolvedValue(updated as any);

    const res = await couponByIdPUT(
      createRequest('/api/coupons/c1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      routeParams({ id: 'c1' }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(updated);
    expect(updateCouponMaster).toHaveBeenCalledWith('c1', { name: 'Updated' });
  });

  // 5. POST /api/coupons/[id]/issue — issues coupons
  it('POST /api/coupons/[id]/issue — issues coupons', async () => {
    const result = { issued: 3 };
    vi.mocked(batchIssueCoupon).mockResolvedValue(result as any);

    const res = await couponIssuePOST(
      createRequest('/api/coupons/c1/issue', {
        method: 'POST',
        body: JSON.stringify({
          customerIds: ['u1', 'u2', 'u3'],
          expiresAt: '2026-12-31',
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
      routeParams({ id: 'c1' }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(result);
    expect(batchIssueCoupon).toHaveBeenCalledWith('c1', ['u1', 'u2', 'u3'], '2026-12-31');
  });

  // 6. POST /api/coupons/[id]/issue — validates customerIds array
  it('POST /api/coupons/[id]/issue — validates customerIds array', async () => {
    const res = await couponIssuePOST(
      createRequest('/api/coupons/c1/issue', {
        method: 'POST',
        body: JSON.stringify({ customerIds: [] }),
        headers: { 'Content-Type': 'application/json' },
      }),
      routeParams({ id: 'c1' }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('対象顧客IDを指定してください');
    expect(batchIssueCoupon).not.toHaveBeenCalled();
  });

  // 7. GET /api/coupons/customer/[id]
  it('GET /api/coupons/customer/[id] — returns customer coupons', async () => {
    const coupons = [{ id: 'ci1', couponId: 'c1', status: 'active' }];
    vi.mocked(getCustomerCoupons).mockResolvedValue(coupons as any);

    const res = await customerCouponsGET(
      createRequest('/api/coupons/customer/u1'),
      routeParams({ customerId: 'u1' }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(coupons);
    expect(getCustomerCoupons).toHaveBeenCalledWith('u1', undefined);
  });
});

// ---------------------------------------------------------------------------
// Tests — Booking API
// ---------------------------------------------------------------------------

describe('Booking API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 8. GET /api/booking/slots
  it('GET /api/booking/slots — returns available slots', async () => {
    const slots = [{ id: 's1', date: '2026-04-01', time: '10:00' }];
    vi.mocked(getAvailableSlots).mockResolvedValue(slots as any);

    const res = await slotsGET(
      createRequest('/api/booking/slots?startDate=2026-04-01&endDate=2026-04-30'),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(slots);
    expect(getAvailableSlots).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-04-01', endDate: '2026-04-30' }),
    );
  });

  // 9. POST /api/booking/slots
  it('POST /api/booking/slots — creates slots', async () => {
    const created = [{ id: 's2' }];
    vi.mocked(bulkCreateSlots).mockResolvedValue(created as any);

    const input = {
      consultantId: 'con1',
      startDate: '2026-04-01',
      endDate: '2026-04-07',
      durationMinutes: 30,
    };

    const res = await slotsPOST(
      createRequest('/api/booking/slots', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(created);
    expect(bulkCreateSlots).toHaveBeenCalledWith('con1', '2026-04-01', '2026-04-07', 30);
  });

  // 10. GET /api/booking/settings
  it('GET /api/booking/settings — returns settings', async () => {
    const settings = { slotDuration: 30, maxPerDay: 8 };
    vi.mocked(getBookingSettings).mockResolvedValue(settings as any);

    const res = await settingsGET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(settings);
  });

  // 11. PUT /api/booking/settings
  it('PUT /api/booking/settings — updates settings', async () => {
    const updated = { slotDuration: 60, maxPerDay: 4 };
    vi.mocked(updateBookingSettings).mockResolvedValue(updated as any);

    const res = await settingsPUT(
      createRequest('/api/booking/settings', {
        method: 'PUT',
        body: JSON.stringify({ slotDuration: 60 }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(updated);
  });

  // 12. GET /api/booking/consultants
  it('GET /api/booking/consultants — returns consultants', async () => {
    const consultants = [{ id: 'con1', name: '田中太郎' }];
    vi.mocked(getConsultants).mockResolvedValue(consultants as any);

    const res = await consultantsGET(createRequest('/api/booking/consultants'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(consultants);
    expect(getConsultants).toHaveBeenCalledWith(false);
  });

  // 13. POST /api/booking/consultants
  it('POST /api/booking/consultants — creates consultant', async () => {
    const input = { name: '山田花子', email: 'hanako@example.com' };
    const created = { id: 'con2', ...input };
    vi.mocked(createConsultant).mockResolvedValue(created as any);

    const res = await consultantsPOST(
      createRequest('/api/booking/consultants', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(created);
  });

  // 14. GET /api/booking/reservations
  it('GET /api/booking/reservations — returns reservations', async () => {
    const reservations = [{ id: 'r1', status: 'confirmed' }];
    vi.mocked(getReservations).mockResolvedValue(reservations as any);

    const res = await reservationsGET(
      createRequest('/api/booking/reservations?status=confirmed'),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(reservations);
    expect(getReservations).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed' }),
    );
  });

  // 15. POST /api/booking/reservations
  it('POST /api/booking/reservations — creates reservation', async () => {
    const consultant = { id: 'con1', name: '田中太郎', meetUrl: 'https://meet.example.com/abc' };
    vi.mocked(getConsultantById).mockResolvedValue(consultant as any);

    const created = { id: 'r2', customerId: 'u1', status: 'pending' };
    vi.mocked(createReservation).mockResolvedValue(created as any);

    const input = {
      customerId: 'u1',
      timeSlotId: 's1',
      consultantId: 'con1',
      serviceType: 'general',
      notes: 'テスト予約',
    };

    const res = await reservationsPOST(
      createRequest('/api/booking/reservations', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(created);
    expect(createReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'u1',
        timeSlotId: 's1',
        consultantId: 'con1',
        meetUrl: 'https://meet.example.com/abc',
      }),
    );
  });

  // 16. PUT /api/booking/reservations/[id]
  it('PUT /api/booking/reservations/[id] — updates status', async () => {
    const updated = { id: 'r1', status: 'confirmed' };
    vi.mocked(confirmReservation).mockResolvedValue(undefined as any);
    vi.mocked(getReservationById).mockResolvedValue(updated as any);

    const res = await reservationByIdPUT(
      createRequest('/api/booking/reservations/r1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'confirm' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      routeParams({ id: 'r1' }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(updated);
    expect(confirmReservation).toHaveBeenCalledWith('r1');
  });

  // 17. GET /api/booking/reservations/stats
  it('GET /api/booking/reservations/stats — returns stats', async () => {
    const stats = { total: 50, confirmed: 30, cancelled: 5, pending: 15 };
    vi.mocked(getReservationStats).mockResolvedValue(stats as any);

    const res = await reservationStatsGET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(stats);
  });
});
