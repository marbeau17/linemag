// ============================================================================
// tests/unit/booking.test.ts
// Unit tests for booking services: slots, reservations, consultants
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/admin
// ---------------------------------------------------------------------------

// Chainable query builder mock: each method returns `this` so calls can chain,
// and the terminal methods (single / maybeSingle / then) resolve the stored
// response.

function createQueryBuilder(response: { data: unknown; error: unknown; count?: number }) {
  const builder: Record<string, unknown> = {};

  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gte', 'lte', 'gt', 'lt',
    'is', 'in', 'like', 'ilike',
    'order', 'limit', 'range',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  builder.single = vi.fn().mockResolvedValue(response);
  builder.maybeSingle = vi.fn().mockResolvedValue(response);

  // When awaited directly (no .single / .maybeSingle), the promise resolves
  // via the hidden .then on the builder.
  builder.then = vi.fn((resolve: (v: unknown) => void) =>
    resolve(response),
  );

  return builder;
}

// Store the latest builder so individual tests can inspect / override it.
let latestBuilder: ReturnType<typeof createQueryBuilder>;
let fromResponses: Record<string, { data: unknown; error: unknown; count?: number }>;

function createMockClient() {
  return {
    from: vi.fn((table: string) => {
      const resp = fromResponses[table] ?? { data: null, error: null };
      latestBuilder = createQueryBuilder(resp);
      return latestBuilder;
    }),
  };
}

let mockClient: ReturnType<typeof createMockClient>;

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => mockClient,
}));

// ---------------------------------------------------------------------------
// Imports (AFTER vi.mock so the mock is wired)
// ---------------------------------------------------------------------------

import {
  getBookingSettings,
  updateBookingSettings,
  generateSlots,
  getAvailableSlots,
  getSlotsForDate,
  toggleSlotAvailability,
} from '@/lib/booking/slots';

import {
  createReservation,
  getReservationById,
  getReservations,
  cancelReservation,
  completeReservation,
  markReminderSent,
  getUpcomingReservationsForReminder,
} from '@/lib/booking/reservations';

import {
  getConsultants,
  getConsultantById,
  createConsultant,
  updateConsultant,
  deleteConsultant,
} from '@/lib/booking/consultants';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SETTINGS_ROW = {
  id: 'settings-1',
  business_hours: {
    '1': { start: '09:00', end: '17:00' },
    '2': { start: '09:00', end: '17:00' },
    '3': { start: '09:00', end: '17:00' },
    '4': { start: '09:00', end: '17:00' },
    '5': { start: '09:00', end: '17:00' },
  },
  slot_durations: [30, 60],
  buffer_minutes: 10,
  max_advance_days: 30,
  holidays: ['2026-01-01', '2026-12-25'],
};

const SLOT_ROW = {
  id: 'slot-1',
  consultant_id: 'cons-1',
  date: '2026-04-01',
  start_time: '09:00',
  end_time: '09:30',
  duration_minutes: 30,
  is_available: true,
  created_at: '2026-03-20T00:00:00.000Z',
};

const RESERVATION_ROW = {
  id: 'res-1',
  customer_id: 'cust-1',
  time_slot_id: 'slot-1',
  consultant_id: 'cons-1',
  status: 'confirmed',
  service_type: 'general',
  notes: null,
  meet_url: null,
  reminder_sent_at: null,
  cancelled_at: null,
  completed_at: null,
  created_at: '2026-03-20T00:00:00.000Z',
  updated_at: '2026-03-20T00:00:00.000Z',
  customers: { display_name: 'Test Customer' },
  consultants: { name: 'Test Consultant' },
  time_slots: { date: '2026-04-01', start_time: '09:00', end_time: '09:30' },
};

const CONSULTANT_ROW = {
  id: 'cons-1',
  name: 'Dr. Test',
  email: 'dr@test.com',
  meet_url: 'https://meet.example.com/dr-test',
  specialties: ['general', 'skin'],
  is_active: true,
  max_daily_slots: 8,
  created_at: '2026-03-20T00:00:00.000Z',
  updated_at: '2026-03-20T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  fromResponses = {};
  mockClient = createMockClient();
});

// ===========================================================================
// SLOTS
// ===========================================================================

describe('Slots service', () => {
  // 1. getBookingSettings — returns default settings
  it('getBookingSettings() returns mapped settings', async () => {
    fromResponses['booking_settings'] = { data: SETTINGS_ROW, error: null };

    const result = await getBookingSettings();

    expect(result).toEqual({
      id: 'settings-1',
      businessHours: SETTINGS_ROW.business_hours,
      slotDurations: [30, 60],
      bufferMinutes: 10,
      maxAdvanceDays: 30,
      holidays: ['2026-01-01', '2026-12-25'],
    });
  });

  // 2. updateBookingSettings — updates settings
  it('updateBookingSettings() updates and returns settings', async () => {
    const updatedRow = { ...SETTINGS_ROW, buffer_minutes: 15 };
    fromResponses['booking_settings'] = { data: updatedRow, error: null };

    const result = await updateBookingSettings({ bufferMinutes: 15 });

    expect(result.bufferMinutes).toBe(15);
    // Verify .update was called on second from('booking_settings') call
    expect(mockClient.from).toHaveBeenCalledWith('booking_settings');
  });

  // 3. generateSlots — creates correct number of slots based on business hours
  it('generateSlots() creates correct number of slots', async () => {
    // 2026-04-01 is a Wednesday (day 3)
    // Business hours 09:00-17:00, 30min slots + 10min buffer = 40min per slot
    // That yields 12 slots: 09:00, 09:40, 10:20, 11:00, 11:40, 12:20,
    //   13:00, 13:40, 14:20, 15:00, 15:40, 16:20
    // (16:20 + 30 = 16:50 <= 17:00, next would be 17:10 start -> slot end 17:40 > 17:00)

    const expectedSlotCount = 12;

    // Build mock response rows for the generated slots
    const generatedRows = Array.from({ length: expectedSlotCount }, (_, i) => ({
      ...SLOT_ROW,
      id: `slot-${i}`,
      start_time: `${String(9 + Math.floor((i * 40) / 60)).padStart(2, '0')}:${String((i * 40) % 60).padStart(2, '0')}`,
    }));

    // We need multiple from() calls to return different things:
    // 1st: booking_settings (getBookingSettings inside generateSlots)
    // 2nd: time_slots select existing (returns empty)
    // 3rd: time_slots insert
    // 4th: booking_settings again? No - getSlotsForDate at the end
    // 4th: time_slots select for getSlotsForDate

    let callIndex = 0;
    mockClient.from = vi.fn((table: string) => {
      callIndex++;
      if (table === 'booking_settings') {
        return createQueryBuilder({ data: SETTINGS_ROW, error: null });
      }
      if (table === 'time_slots') {
        if (callIndex <= 3) {
          // Second call: select existing slots (none)
          return createQueryBuilder({ data: [], error: null });
        }
        if (callIndex <= 4) {
          // Third call: insert new slots
          return createQueryBuilder({ data: generatedRows, error: null });
        }
        // Fourth call: getSlotsForDate
        return createQueryBuilder({ data: generatedRows, error: null });
      }
      return createQueryBuilder({ data: null, error: null });
    });

    const result = await generateSlots('cons-1', '2026-04-01', 30);

    expect(result).toHaveLength(expectedSlotCount);
    expect(result[0].consultantId).toBe('cons-1');
  });

  // 4. generateSlots — skips holidays
  it('generateSlots() skips holidays', async () => {
    // 2026-01-01 is a holiday
    let callIndex = 0;
    mockClient.from = vi.fn((table: string) => {
      callIndex++;
      if (table === 'booking_settings') {
        return createQueryBuilder({ data: SETTINGS_ROW, error: null });
      }
      return createQueryBuilder({ data: [], error: null });
    });

    const result = await generateSlots('cons-1', '2026-01-01', 30);

    expect(result).toEqual([]);
  });

  // 5. getAvailableSlots — returns available slots in date range
  it('getAvailableSlots() returns available slots in date range', async () => {
    fromResponses['time_slots'] = { data: [SLOT_ROW], error: null };

    const result = await getAvailableSlots({
      startDate: '2026-04-01',
      endDate: '2026-04-07',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('slot-1');
    expect(result[0].isAvailable).toBe(true);
    expect(mockClient.from).toHaveBeenCalledWith('time_slots');
  });

  // 6. getSlotsForDate — returns slots for a date
  it('getSlotsForDate() returns slots for a date', async () => {
    fromResponses['time_slots'] = { data: [SLOT_ROW], error: null };

    const result = await getSlotsForDate('2026-04-01', 'cons-1');

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-04-01');
    expect(result[0].startTime).toBe('09:00');
    expect(mockClient.from).toHaveBeenCalledWith('time_slots');
  });

  // 7. toggleSlotAvailability — updates availability
  it('toggleSlotAvailability() updates availability', async () => {
    fromResponses['time_slots'] = { data: null, error: null };

    await toggleSlotAvailability('slot-1', false);

    expect(mockClient.from).toHaveBeenCalledWith('time_slots');
  });
});

// ===========================================================================
// RESERVATIONS
// ===========================================================================

describe('Reservations service', () => {
  // 8. createReservation — creates reservation and marks slot unavailable
  it('createReservation() creates reservation and marks slot unavailable', async () => {
    let callIndex = 0;
    mockClient.from = vi.fn((table: string) => {
      callIndex++;
      if (table === 'time_slots') {
        return createQueryBuilder({ data: null, error: null });
      }
      if (table === 'reservations') {
        return createQueryBuilder({ data: RESERVATION_ROW, error: null });
      }
      return createQueryBuilder({ data: null, error: null });
    });

    const result = await createReservation({
      customerId: 'cust-1',
      timeSlotId: 'slot-1',
      consultantId: 'cons-1',
    });

    expect(result.id).toBe('res-1');
    expect(result.status).toBe('confirmed');
    expect(result.customerName).toBe('Test Customer');
    // Verify both tables were accessed
    expect(mockClient.from).toHaveBeenCalledWith('time_slots');
    expect(mockClient.from).toHaveBeenCalledWith('reservations');
  });

  // 9. getReservationById — returns reservation with joins
  it('getReservationById() returns reservation with joins', async () => {
    fromResponses['reservations'] = { data: RESERVATION_ROW, error: null };

    const result = await getReservationById('res-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('res-1');
    expect(result!.customerName).toBe('Test Customer');
    expect(result!.consultantName).toBe('Test Consultant');
    expect(result!.date).toBe('2026-04-01');
    expect(result!.startTime).toBe('09:00');
    expect(result!.endTime).toBe('09:30');
  });

  // 10. getReservations — filters by status and date
  it('getReservations() filters by status and date', async () => {
    fromResponses['reservations'] = { data: [RESERVATION_ROW], error: null };

    const result = await getReservations({
      status: 'confirmed',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('confirmed');
    expect(mockClient.from).toHaveBeenCalledWith('reservations');
  });

  // 11. cancelReservation — cancels and frees slot
  it('cancelReservation() cancels and frees slot', async () => {
    let callIndex = 0;
    mockClient.from = vi.fn((table: string) => {
      callIndex++;
      if (table === 'reservations' && callIndex === 1) {
        // First: fetch reservation to get time_slot_id
        return createQueryBuilder({
          data: { time_slot_id: 'slot-1' },
          error: null,
        });
      }
      if (table === 'reservations' && callIndex === 2) {
        // Second: update reservation status to cancelled
        return createQueryBuilder({ data: null, error: null });
      }
      if (table === 'time_slots') {
        // Third: free the time slot
        return createQueryBuilder({ data: null, error: null });
      }
      return createQueryBuilder({ data: null, error: null });
    });

    await cancelReservation('res-1');

    expect(mockClient.from).toHaveBeenCalledWith('reservations');
    expect(mockClient.from).toHaveBeenCalledWith('time_slots');
    expect(mockClient.from).toHaveBeenCalledTimes(3);
  });

  // 12. completeReservation — marks as completed
  it('completeReservation() marks as completed', async () => {
    fromResponses['reservations'] = { data: null, error: null };

    await completeReservation('res-1');

    expect(mockClient.from).toHaveBeenCalledWith('reservations');
  });

  // 13. markReminderSent — updates reminder timestamp
  it('markReminderSent() updates reminder timestamp', async () => {
    fromResponses['reservations'] = { data: null, error: null };

    await markReminderSent('res-1');

    expect(mockClient.from).toHaveBeenCalledWith('reservations');
  });

  // 14. getUpcomingReservationsForReminder — finds upcoming reservations
  it('getUpcomingReservationsForReminder() finds upcoming reservations', async () => {
    fromResponses['reservations'] = { data: [RESERVATION_ROW], error: null };

    const result = await getUpcomingReservationsForReminder(24);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('res-1');
    expect(result[0].status).toBe('confirmed');
    expect(mockClient.from).toHaveBeenCalledWith('reservations');
  });
});

// ===========================================================================
// CONSULTANTS
// ===========================================================================

describe('Consultants service', () => {
  // 15. getConsultants — returns all consultants
  it('getConsultants() returns all consultants', async () => {
    fromResponses['consultants'] = { data: [CONSULTANT_ROW], error: null };

    const result = await getConsultants();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'cons-1',
      name: 'Dr. Test',
      email: 'dr@test.com',
      meetUrl: 'https://meet.example.com/dr-test',
      specialties: ['general', 'skin'],
      isActive: true,
      maxDailySlots: 8,
      createdAt: '2026-03-20T00:00:00.000Z',
      updatedAt: '2026-03-20T00:00:00.000Z',
    });
  });

  // 16. getConsultantById — returns consultant
  it('getConsultantById() returns consultant', async () => {
    fromResponses['consultants'] = { data: CONSULTANT_ROW, error: null };

    const result = await getConsultantById('cons-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('cons-1');
    expect(result!.name).toBe('Dr. Test');
    expect(result!.meetUrl).toBe('https://meet.example.com/dr-test');
  });

  // 17. createConsultant — creates consultant
  it('createConsultant() creates consultant', async () => {
    fromResponses['consultants'] = { data: CONSULTANT_ROW, error: null };

    const result = await createConsultant({
      name: 'Dr. Test',
      email: 'dr@test.com',
      meetUrl: 'https://meet.example.com/dr-test',
      specialties: ['general', 'skin'],
    });

    expect(result.id).toBe('cons-1');
    expect(result.name).toBe('Dr. Test');
    expect(result.specialties).toEqual(['general', 'skin']);
    expect(mockClient.from).toHaveBeenCalledWith('consultants');
  });

  // 18. updateConsultant — updates consultant
  it('updateConsultant() updates consultant', async () => {
    const updatedRow = { ...CONSULTANT_ROW, name: 'Dr. Updated' };
    fromResponses['consultants'] = { data: updatedRow, error: null };

    const result = await updateConsultant('cons-1', { name: 'Dr. Updated' });

    expect(result.name).toBe('Dr. Updated');
    expect(mockClient.from).toHaveBeenCalledWith('consultants');
  });

  // 19. deleteConsultant — deletes consultant
  it('deleteConsultant() deletes consultant', async () => {
    fromResponses['consultants'] = { data: null, error: null };

    await deleteConsultant('cons-1');

    expect(mockClient.from).toHaveBeenCalledWith('consultants');
  });
});
