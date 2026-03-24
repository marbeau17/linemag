import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  type: 'static' | 'dynamic';
  rules: SegmentRule[];
  autoRefresh: boolean;
  lastComputedAt: string | null;
  customerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentRule {
  field: string; // e.g. 'prefecture', 'membership_tier', 'tag', 'last_seen_at'
  operator: string; // e.g. 'eq', 'neq', 'contains', 'gt', 'lt', 'in'
  value: unknown;
}

export interface CreateSegmentInput {
  name: string;
  description?: string;
  type: 'static' | 'dynamic';
  rules?: SegmentRule[];
  autoRefresh?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SegmentRow {
  id: string;
  name: string;
  description: string | null;
  type: 'static' | 'dynamic';
  rules: SegmentRule[];
  auto_refresh: boolean;
  last_computed_at: string | null;
  customer_count: number;
  created_at: string;
  updated_at: string;
}

function toSegment(row: SegmentRow): Segment {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    rules: row.rules ?? [],
    autoRefresh: row.auto_refresh,
    lastComputedAt: row.last_computed_at,
    customerCount: row.customer_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getSegments(): Promise<Segment[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch segments: ${error.message}`);
  }

  return (data as SegmentRow[]).map(toSegment);
}

export async function getSegmentById(id: string): Promise<Segment | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch segment: ${error.message}`);
  }

  return data ? toSegment(data as SegmentRow) : null;
}

export async function createSegment(input: CreateSegmentInput): Promise<Segment> {
  const supabase = getAdminClient();

  const payload = {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    rules: (input.rules ?? []) as never,
    auto_refresh: input.autoRefresh ?? false,
    customer_count: 0,
  };

  const { data, error } = await supabase
    .from('segments')
    .insert(payload as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create segment: ${error.message}`);
  }

  return toSegment(data as SegmentRow);
}

export async function updateSegment(
  id: string,
  input: Partial<CreateSegmentInput>,
): Promise<Segment> {
  const supabase = getAdminClient();

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.type !== undefined) payload.type = input.type;
  if (input.rules !== undefined) payload.rules = input.rules;
  if (input.autoRefresh !== undefined) payload.auto_refresh = input.autoRefresh;

  const { data, error } = await supabase
    .from('segments')
    .update(payload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update segment: ${error.message}`);
  }

  return toSegment(data as SegmentRow);
}

export async function deleteSegment(id: string): Promise<void> {
  const supabase = getAdminClient();

  // Delete members first to honour the composite PK / FK relationship
  const { error: membersError } = await supabase
    .from('segment_members')
    .delete()
    .eq('segment_id', id);

  if (membersError) {
    throw new Error(`Failed to delete segment members: ${membersError.message}`);
  }

  const { error } = await supabase
    .from('segments')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete segment: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function getSegmentMembers(segmentId: string): Promise<string[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('segment_members')
    .select('customer_id')
    .eq('segment_id', segmentId);

  if (error) {
    throw new Error(`Failed to fetch segment members: ${error.message}`);
  }

  return (data ?? []).map((row: { customer_id: string }) => row.customer_id);
}

export async function addMembersToSegment(
  segmentId: string,
  customerIds: string[],
): Promise<void> {
  if (customerIds.length === 0) return;

  const supabase = getAdminClient();

  const rows = customerIds.map((customerId) => ({
    segment_id: segmentId,
    customer_id: customerId,
  }));

  const { error } = await supabase
    .from('segment_members')
    .upsert(rows as never, { onConflict: 'segment_id,customer_id' });

  if (error) {
    throw new Error(`Failed to add members to segment: ${error.message}`);
  }

  // Keep customer_count in sync
  await refreshSegmentCount(segmentId);
}

export async function removeMemberFromSegment(
  segmentId: string,
  customerId: string,
): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('segment_members')
    .delete()
    .eq('segment_id', segmentId)
    .eq('customer_id', customerId);

  if (error) {
    throw new Error(`Failed to remove member from segment: ${error.message}`);
  }

  // Keep customer_count in sync
  await refreshSegmentCount(segmentId);
}

export async function refreshSegmentCount(segmentId: string): Promise<number> {
  const supabase = getAdminClient();

  const { count, error: countError } = await supabase
    .from('segment_members')
    .select('*', { count: 'exact', head: true })
    .eq('segment_id', segmentId);

  if (countError) {
    throw new Error(`Failed to count segment members: ${countError.message}`);
  }

  const memberCount = count ?? 0;

  const { error: updateError } = await supabase
    .from('segments')
    .update({
      customer_count: memberCount,
      last_computed_at: new Date().toISOString(),
    } as never)
    .eq('id', segmentId);

  if (updateError) {
    throw new Error(`Failed to update segment count: ${updateError.message}`);
  }

  return memberCount;
}
