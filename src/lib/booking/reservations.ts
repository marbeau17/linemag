// ============================================================================
// src/lib/booking/reservations.ts
// Reservation management service using Supabase admin client
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Reservation {
  id: string;
  customerId: string;
  timeSlotId: string;
  consultantId: string;
  status: 'pending' | 'confirmed' | 'reminded' | 'completed' | 'cancelled' | 'no_show';
  serviceType: string;
  notes: string | null;
  meetUrl: string | null;
  reminderSentAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  customerName?: string;
  consultantName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface CreateReservationInput {
  customerId: string;
  timeSlotId: string;
  consultantId: string;
  serviceType?: string;
  notes?: string;
  meetUrl?: string;
}

// ---------------------------------------------------------------------------
// Row <-> Reservation mapping
// ---------------------------------------------------------------------------

/** DB row shape (snake_case) with optional joined relations */
interface ReservationRow {
  id: string;
  customer_id: string;
  time_slot_id: string;
  consultant_id: string;
  status: string;
  service_type: string;
  notes: string | null;
  meet_url: string | null;
  reminder_sent_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  customers?: { display_name: string | null } | null;
  consultants?: { name: string | null } | null;
  time_slots?: { date: string; start_time: string; end_time: string } | null;
}

function rowToReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    customerId: row.customer_id,
    timeSlotId: row.time_slot_id,
    consultantId: row.consultant_id,
    status: row.status as Reservation['status'],
    serviceType: row.service_type,
    notes: row.notes,
    meetUrl: row.meet_url,
    reminderSentAt: row.reminder_sent_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customers?.display_name ?? undefined,
    consultantName: row.consultants?.name ?? undefined,
    date: row.time_slots?.date ?? undefined,
    startTime: row.time_slots?.start_time ?? undefined,
    endTime: row.time_slots?.end_time ?? undefined,
  };
}

/** Select string that includes joined relations */
const SELECT_WITH_JOINS =
  '*, customers(display_name), consultants(name), time_slots(date, start_time, end_time)';

// ---------------------------------------------------------------------------
// CRUD Functions
// ---------------------------------------------------------------------------

/**
 * Create a new reservation.
 *
 * Marks the associated time_slot as unavailable and inserts the reservation
 * with 'confirmed' status.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<Reservation> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  // Mark the time slot as unavailable
  const { error: slotError } = await supabase
    .from('time_slots')
    .update({ is_available: false, updated_at: now } as never)
    .eq('id', input.timeSlotId);

  if (slotError) {
    throw new Error(
      `Failed to update time slot ${input.timeSlotId}: ${slotError.message}`,
    );
  }

  // Insert the reservation
  const row = {
    customer_id: input.customerId,
    time_slot_id: input.timeSlotId,
    consultant_id: input.consultantId,
    status: 'confirmed',
    service_type: input.serviceType ?? 'general',
    notes: input.notes ?? null,
    meet_url: input.meetUrl ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('reservations')
    .insert(row as never)
    .select(SELECT_WITH_JOINS)
    .single();

  if (error) {
    throw new Error(`Failed to create reservation: ${error.message}`);
  }

  return rowToReservation(data as ReservationRow);
}

/**
 * Fetch a single reservation by primary key (with joins).
 */
export async function getReservationById(
  id: string,
): Promise<Reservation | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('reservations')
    .select(SELECT_WITH_JOINS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch reservation ${id}: ${error.message}`);
  }

  return data ? rowToReservation(data as ReservationRow) : null;
}

/**
 * Fetch reservations with optional filtering, pagination, and joins.
 */
export async function getReservations(
  options: {
    status?: string;
    consultantId?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Reservation[]> {
  const supabase = getAdminClient();

  let query = supabase
    .from('reservations')
    .select(SELECT_WITH_JOINS);

  if (options.status) {
    query = query.eq('status', options.status);
  }
  if (options.consultantId) {
    query = query.eq('consultant_id', options.consultantId);
  }
  if (options.customerId) {
    query = query.eq('customer_id', options.customerId);
  }
  if (options.dateFrom) {
    query = query.gte('time_slots.date', options.dateFrom);
  }
  if (options.dateTo) {
    query = query.lte('time_slots.date', options.dateTo);
  }

  query = query.order('created_at', { ascending: false });

  if (options.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch reservations: ${error.message}`);
  }

  return (data as ReservationRow[]).map(rowToReservation);
}

// ---------------------------------------------------------------------------
// Status Updates
// ---------------------------------------------------------------------------

/**
 * Confirm a pending reservation.
 */
export async function confirmReservation(id: string): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() } as never)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to confirm reservation ${id}: ${error.message}`);
  }
}

/**
 * Cancel a reservation and free the associated time slot.
 */
export async function cancelReservation(id: string): Promise<void> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  // Fetch the reservation to get the time_slot_id
  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('time_slot_id')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch reservation ${id}: ${fetchError.message}`);
  }

  // Cancel the reservation
  const { error } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      updated_at: now,
    } as never)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to cancel reservation ${id}: ${error.message}`);
  }

  // Free the time slot
  const { error: slotError } = await supabase
    .from('time_slots')
    .update({ is_available: true, updated_at: now } as never)
    .eq('id', (reservation as { time_slot_id: string }).time_slot_id);

  if (slotError) {
    throw new Error(
      `Failed to free time slot for reservation ${id}: ${slotError.message}`,
    );
  }
}

/**
 * Mark a reservation as completed.
 */
export async function completeReservation(id: string): Promise<void> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('reservations')
    .update({
      status: 'completed',
      completed_at: now,
      updated_at: now,
    } as never)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to complete reservation ${id}: ${error.message}`);
  }
}

/**
 * Mark a reservation as no-show.
 */
export async function markNoShow(id: string): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('reservations')
    .update({
      status: 'no_show',
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to mark no-show for reservation ${id}: ${error.message}`);
  }
}

/**
 * Record that a reminder was sent for this reservation.
 */
export async function markReminderSent(id: string): Promise<void> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('reservations')
    .update({
      status: 'reminded',
      reminder_sent_at: now,
      updated_at: now,
    } as never)
    .eq('id', id);

  if (error) {
    throw new Error(
      `Failed to mark reminder sent for reservation ${id}: ${error.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Reminder Query
// ---------------------------------------------------------------------------

/**
 * Get reservations needing reminders: confirmed (not yet reminded),
 * starting within the specified number of hours.
 */
export async function getUpcomingReservationsForReminder(
  hoursAhead: number,
): Promise<Reservation[]> {
  const supabase = getAdminClient();

  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const today = now.toISOString().slice(0, 10);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const cutoffTime = cutoff.toISOString().slice(11, 19);

  const { data, error } = await supabase
    .from('reservations')
    .select(SELECT_WITH_JOINS)
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('time_slots.date', today)
    .lte('time_slots.date', cutoffDate)
    .lte('time_slots.start_time', cutoffTime);

  if (error) {
    throw new Error(
      `Failed to fetch reservations for reminder: ${error.message}`,
    );
  }

  return (data as ReservationRow[]).map(rowToReservation);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Return summary statistics for reservations.
 */
export async function getReservationStats(): Promise<{
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
  cancelRate: number;
}> {
  const supabase = getAdminClient();
  const now = new Date();

  // Today (start of day)
  const todayStr = now.toISOString().slice(0, 10);

  // Start of week (Monday)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const weekStart = monday.toISOString().slice(0, 10);

  // Start of month
  const monthStart = `${todayStr.slice(0, 7)}-01`;

  // Run queries in parallel
  const [todayResult, weekResult, monthResult, cancelledResult, monthTotalResult] =
    await Promise.all([
      supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${todayStr}T00:00:00.000Z`),
      supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${weekStart}T00:00:00.000Z`),
      supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${monthStart}T00:00:00.000Z`),
      supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('created_at', `${monthStart}T00:00:00.000Z`),
      supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${monthStart}T00:00:00.000Z`),
    ]);

  if (todayResult.error) {
    throw new Error(`Failed to fetch today stats: ${todayResult.error.message}`);
  }
  if (weekResult.error) {
    throw new Error(`Failed to fetch week stats: ${weekResult.error.message}`);
  }
  if (monthResult.error) {
    throw new Error(`Failed to fetch month stats: ${monthResult.error.message}`);
  }
  if (cancelledResult.error) {
    throw new Error(`Failed to fetch cancel stats: ${cancelledResult.error.message}`);
  }

  const totalThisMonth = monthTotalResult.count ?? 0;
  const cancelledThisMonth = cancelledResult.count ?? 0;
  const cancelRate =
    totalThisMonth > 0 ? cancelledThisMonth / totalThisMonth : 0;

  return {
    totalToday: todayResult.count ?? 0,
    totalThisWeek: weekResult.count ?? 0,
    totalThisMonth,
    cancelRate: Math.round(cancelRate * 10000) / 10000, // 4 decimal places
  };
}
