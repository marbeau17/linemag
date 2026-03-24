// ============================================================================
// src/lib/booking/consultants.ts
// Consultant management service
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---- Row type (snake_case — matches DB columns) ----------------------------

interface ConsultantRow {
  id: string;
  name: string;
  email: string;
  meet_url: string;
  specialties: string[];
  is_active: boolean;
  max_daily_slots: number;
  created_at: string;
  updated_at: string;
}

// ---- Public interfaces (camelCase) -----------------------------------------

export interface Consultant {
  id: string;
  name: string;
  email: string;
  meetUrl: string;
  specialties: string[];
  isActive: boolean;
  maxDailySlots: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsultantInput {
  name: string;
  email: string;
  meetUrl: string;
  specialties?: string[];
  maxDailySlots?: number;
}

// ---- Mapping helper --------------------------------------------------------

function toConsultant(row: ConsultantRow): Consultant {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    meetUrl: row.meet_url,
    specialties: row.specialties,
    isActive: row.is_active,
    maxDailySlots: row.max_daily_slots,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- CRUD ------------------------------------------------------------------

const TABLE = 'consultants';

export async function getConsultants(
  activeOnly?: boolean,
): Promise<Consultant[]> {
  const supabase = getAdminClient();

  let query = supabase.from(TABLE).select('*').order('name');

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch consultants: ${error.message}`);

  return (data as ConsultantRow[]).map(toConsultant);
}

export async function getConsultantById(
  id: string,
): Promise<Consultant | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error)
    throw new Error(`Failed to fetch consultant ${id}: ${error.message}`);

  return data ? toConsultant(data as ConsultantRow) : null;
}

export async function createConsultant(
  input: CreateConsultantInput,
): Promise<Consultant> {
  const supabase = getAdminClient();

  const row = {
    name: input.name,
    email: input.email,
    meet_url: input.meetUrl,
    specialties: input.specialties ?? [],
    max_daily_slots: input.maxDailySlots ?? 8,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row as never)
    .select('*')
    .single();

  if (error)
    throw new Error(`Failed to create consultant: ${error.message}`);

  return toConsultant(data as ConsultantRow);
}

export async function updateConsultant(
  id: string,
  input: Partial<CreateConsultantInput> & { isActive?: boolean },
): Promise<Consultant> {
  const supabase = getAdminClient();

  const row: Record<string, unknown> = {};

  if (input.name !== undefined) row.name = input.name;
  if (input.email !== undefined) row.email = input.email;
  if (input.meetUrl !== undefined) row.meet_url = input.meetUrl;
  if (input.specialties !== undefined) row.specialties = input.specialties;
  if (input.maxDailySlots !== undefined)
    row.max_daily_slots = input.maxDailySlots;
  if (input.isActive !== undefined) row.is_active = input.isActive;

  const { data, error } = await supabase
    .from(TABLE)
    .update(row as never)
    .eq('id', id)
    .select('*')
    .single();

  if (error)
    throw new Error(`Failed to update consultant ${id}: ${error.message}`);

  return toConsultant(data as ConsultantRow);
}

export async function deleteConsultant(id: string): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase.from(TABLE).delete().eq('id', id);

  if (error)
    throw new Error(`Failed to delete consultant ${id}: ${error.message}`);
}
