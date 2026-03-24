// ============================================================================
// src/lib/booking/slots.ts
// Time slot management service
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeSlot {
  id: string;
  consultantId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  isAvailable: boolean;
  createdAt: string;
}

export interface BookingSettings {
  id: string;
  businessHours: Record<string, { start: string; end: string }>;
  slotDurations: number[];
  bufferMinutes: number;
  maxAdvanceDays: number;
  holidays: string[]; // YYYY-MM-DD array
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Day-of-week key used in businessHours (0 = Sunday … 6 = Saturday) */
function dayKey(date: string): string {
  return String(new Date(date).getDay());
}

/** Add minutes to an "HH:MM" string and return "HH:MM" */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Iterate dates from startDate to endDate (inclusive), returning YYYY-MM-DD strings */
function* dateRange(startDate: string, endDate: string): Generator<string> {
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    yield current.toISOString().slice(0, 10);
    current.setDate(current.getDate() + 1);
  }
}

// ---------------------------------------------------------------------------
// Booking Settings
// ---------------------------------------------------------------------------

export async function getBookingSettings(): Promise<BookingSettings> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('booking_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) throw new Error(`Failed to fetch booking settings: ${error.message}`);

  return {
    id: data.id,
    businessHours: data.business_hours,
    slotDurations: data.slot_durations,
    bufferMinutes: data.buffer_minutes,
    maxAdvanceDays: data.max_advance_days,
    holidays: data.holidays ?? [],
  };
}

export async function updateBookingSettings(
  settings: Partial<BookingSettings>,
): Promise<BookingSettings> {
  const supabase = getAdminClient();

  const current = await getBookingSettings();

  const payload: Record<string, unknown> = {};
  if (settings.businessHours !== undefined) payload.business_hours = settings.businessHours;
  if (settings.slotDurations !== undefined) payload.slot_durations = settings.slotDurations;
  if (settings.bufferMinutes !== undefined) payload.buffer_minutes = settings.bufferMinutes;
  if (settings.maxAdvanceDays !== undefined) payload.max_advance_days = settings.maxAdvanceDays;
  if (settings.holidays !== undefined) payload.holidays = settings.holidays;

  const { data, error } = await supabase
    .from('booking_settings')
    .update(payload as never)
    .eq('id', current.id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update booking settings: ${error.message}`);

  return {
    id: data.id,
    businessHours: data.business_hours,
    slotDurations: data.slot_durations,
    bufferMinutes: data.buffer_minutes,
    maxAdvanceDays: data.max_advance_days,
    holidays: data.holidays ?? [],
  };
}

// ---------------------------------------------------------------------------
// Slot Generation
// ---------------------------------------------------------------------------

export async function generateSlots(
  consultantId: string,
  date: string,
  durationMinutes: number,
): Promise<TimeSlot[]> {
  const supabase = getAdminClient();
  const settings = await getBookingSettings();

  // Skip holidays
  if (settings.holidays.includes(date)) return [];

  // Check business hours for the day-of-week
  const hours = settings.businessHours[dayKey(date)];
  if (!hours) return [];

  // Build candidate slots
  const candidates: { startTime: string; endTime: string }[] = [];
  let cursor = hours.start;

  while (cursor < hours.end) {
    const slotEnd = addMinutes(cursor, durationMinutes);
    if (slotEnd > hours.end) break;

    candidates.push({ startTime: cursor, endTime: slotEnd });
    cursor = addMinutes(cursor, durationMinutes + settings.bufferMinutes);
  }

  if (candidates.length === 0) return [];

  // Fetch existing slots for this consultant + date so we don't duplicate
  const { data: existing } = await supabase
    .from('time_slots')
    .select('start_time')
    .eq('consultant_id', consultantId)
    .eq('date', date);

  const existingStarts = new Set((existing ?? []).map((r: { start_time: string }) => r.start_time));

  // Filter to only new slots
  const newSlots = candidates.filter((c) => !existingStarts.has(c.startTime));

  if (newSlots.length === 0) {
    // Return existing slots instead
    return getSlotsForDate(date, consultantId);
  }

  const rows = newSlots.map((s) => ({
    consultant_id: consultantId,
    date,
    start_time: s.startTime,
    end_time: s.endTime,
    duration_minutes: durationMinutes,
    is_available: true,
  }));

  const { data: inserted, error } = await supabase
    .from('time_slots')
    .insert(rows as never)
    .select('*');

  if (error) throw new Error(`Failed to generate slots: ${error.message}`);

  // Return all slots for this date (existing + newly created)
  return getSlotsForDate(date, consultantId);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAvailableSlots(options: {
  startDate: string;
  endDate: string;
  durationMinutes?: number;
  consultantId?: string;
}): Promise<TimeSlot[]> {
  const supabase = getAdminClient();

  let query = supabase
    .from('time_slots')
    .select('*')
    .gte('date', options.startDate)
    .lte('date', options.endDate)
    .eq('is_available', true)
    .order('date')
    .order('start_time');

  if (options.durationMinutes) {
    query = query.eq('duration_minutes', options.durationMinutes);
  }
  if (options.consultantId) {
    query = query.eq('consultant_id', options.consultantId);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch available slots: ${error.message}`);

  return (data ?? []).map(mapRow);
}

export async function getSlotsForDate(
  date: string,
  consultantId?: string,
): Promise<TimeSlot[]> {
  const supabase = getAdminClient();

  let query = supabase
    .from('time_slots')
    .select('*')
    .eq('date', date)
    .order('start_time');

  if (consultantId) {
    query = query.eq('consultant_id', consultantId);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch slots for date: ${error.message}`);

  return (data ?? []).map(mapRow);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function toggleSlotAvailability(
  slotId: string,
  isAvailable: boolean,
): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('time_slots')
    .update({ is_available: isAvailable } as never)
    .eq('id', slotId);

  if (error) throw new Error(`Failed to toggle slot availability: ${error.message}`);
}

export async function bulkCreateSlots(
  consultantId: string,
  startDate: string,
  endDate: string,
  durationMinutes: number,
): Promise<number> {
  let totalCreated = 0;

  const dates = Array.from(dateRange(startDate, endDate));
  for (const date of dates) {
    const slots = await generateSlots(consultantId, date, durationMinutes);
    totalCreated += slots.length;
  }

  return totalCreated;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapRow(row: Record<string, unknown>): TimeSlot {
  return {
    id: row.id as string,
    consultantId: row.consultant_id as string,
    date: row.date as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    durationMinutes: row.duration_minutes as number,
    isAvailable: row.is_available as boolean,
    createdAt: row.created_at as string,
  };
}
