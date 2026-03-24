import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ABTest {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  testType: 'template' | 'content' | 'timing' | 'segment';
  variantA: Record<string, unknown>;
  variantB: Record<string, unknown>;
  targetSegmentId: string | null;
  sampleSize: number;
  metric: string;
  results: Record<string, unknown>;
  winner: 'A' | 'B' | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ABTestAssignment {
  id: string;
  abTestId: string;
  customerId: string;
  variant: 'A' | 'B';
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
}

export interface CreateABTestInput {
  name: string;
  description?: string;
  testType: 'template' | 'content' | 'timing' | 'segment';
  variantA: Record<string, unknown>;
  variantB: Record<string, unknown>;
  targetSegmentId?: string;
  sampleSize?: number;
  metric?: string;
}

// ---------------------------------------------------------------------------
// Row types (snake_case from DB)
// ---------------------------------------------------------------------------

interface ABTestRow {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  test_type: 'template' | 'content' | 'timing' | 'segment';
  variant_a: Record<string, unknown>;
  variant_b: Record<string, unknown>;
  target_segment_id: string | null;
  sample_size: number;
  metric: string;
  results: Record<string, unknown>;
  winner: 'A' | 'B' | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ABTestAssignmentRow {
  id: string;
  ab_test_id: string;
  customer_id: string;
  variant: 'A' | 'B';
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  converted_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toABTest(row: ABTestRow): ABTest {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    testType: row.test_type,
    variantA: row.variant_a ?? {},
    variantB: row.variant_b ?? {},
    targetSegmentId: row.target_segment_id,
    sampleSize: row.sample_size,
    metric: row.metric,
    results: row.results ?? {},
    winner: row.winner,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAssignment(row: ABTestAssignmentRow): ABTestAssignment {
  return {
    id: row.id,
    abTestId: row.ab_test_id,
    customerId: row.customer_id,
    variant: row.variant,
    deliveredAt: row.delivered_at,
    openedAt: row.opened_at,
    clickedAt: row.clicked_at,
    convertedAt: row.converted_at,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getABTests(): Promise<ABTest[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('ab_tests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch AB tests: ${error.message}`);
  }

  return (data as ABTestRow[]).map(toABTest);
}

export async function getABTestById(id: string): Promise<ABTest | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('ab_tests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch AB test: ${error.message}`);
  }

  return data ? toABTest(data as ABTestRow) : null;
}

export async function createABTest(input: CreateABTestInput): Promise<ABTest> {
  const supabase = getAdminClient();

  const payload = {
    name: input.name,
    description: input.description ?? null,
    test_type: input.testType,
    variant_a: input.variantA as never,
    variant_b: input.variantB as never,
    target_segment_id: input.targetSegmentId ?? null,
    sample_size: input.sampleSize ?? 1000,
    metric: input.metric ?? 'open_rate',
    status: 'draft',
    results: {} as never,
    winner: null,
  };

  const { data, error } = await supabase
    .from('ab_tests')
    .insert(payload as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create AB test: ${error.message}`);
  }

  return toABTest(data as ABTestRow);
}

export async function updateABTest(
  id: string,
  input: Partial<CreateABTestInput> & { status?: string; winner?: string },
): Promise<ABTest> {
  const supabase = getAdminClient();

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.testType !== undefined) payload.test_type = input.testType;
  if (input.variantA !== undefined) payload.variant_a = input.variantA;
  if (input.variantB !== undefined) payload.variant_b = input.variantB;
  if (input.targetSegmentId !== undefined) payload.target_segment_id = input.targetSegmentId;
  if (input.sampleSize !== undefined) payload.sample_size = input.sampleSize;
  if (input.metric !== undefined) payload.metric = input.metric;
  if (input.status !== undefined) payload.status = input.status;
  if (input.winner !== undefined) payload.winner = input.winner;

  const { data, error } = await supabase
    .from('ab_tests')
    .update(payload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update AB test: ${error.message}`);
  }

  return toABTest(data as ABTestRow);
}

export async function deleteABTest(id: string): Promise<void> {
  const supabase = getAdminClient();

  // Delete assignments first to honour FK relationship
  const { error: assignmentsError } = await supabase
    .from('ab_test_assignments')
    .delete()
    .eq('ab_test_id', id);

  if (assignmentsError) {
    throw new Error(`Failed to delete AB test assignments: ${assignmentsError.message}`);
  }

  const { error } = await supabase
    .from('ab_tests')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete AB test: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export async function assignCustomersToTest(
  testId: string,
  customerIds: string[],
): Promise<void> {
  if (customerIds.length === 0) return;

  const supabase = getAdminClient();

  const rows = customerIds.map((customerId) => ({
    ab_test_id: testId,
    customer_id: customerId,
    variant: Math.random() < 0.5 ? 'A' : 'B',
  }));

  const { error } = await supabase
    .from('ab_test_assignments')
    .insert(rows as never);

  if (error) {
    throw new Error(`Failed to assign customers to AB test: ${error.message}`);
  }
}

export async function getTestAssignments(testId: string): Promise<ABTestAssignment[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('ab_test_assignments')
    .select('*')
    .eq('ab_test_id', testId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch AB test assignments: ${error.message}`);
  }

  return (data as ABTestAssignmentRow[]).map(toAssignment);
}

export async function recordAssignmentEvent(
  assignmentId: string,
  event: 'delivered' | 'opened' | 'clicked' | 'converted',
): Promise<void> {
  const supabase = getAdminClient();

  const columnMap: Record<string, string> = {
    delivered: 'delivered_at',
    opened: 'opened_at',
    clicked: 'clicked_at',
    converted: 'converted_at',
  };

  const payload = {
    [columnMap[event]]: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('ab_test_assignments')
    .update(payload as never)
    .eq('id', assignmentId);

  if (error) {
    throw new Error(`Failed to record assignment event: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export async function calculateTestResults(testId: string): Promise<{
  variantA: { total: number; delivered: number; opened: number; clicked: number; converted: number; rate: number };
  variantB: { total: number; delivered: number; opened: number; clicked: number; converted: number; rate: number };
  winner: 'A' | 'B' | null;
  isSignificant: boolean;
}> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('ab_test_assignments')
    .select('*')
    .eq('ab_test_id', testId);

  if (error) {
    throw new Error(`Failed to fetch assignments for results: ${error.message}`);
  }

  const assignments = (data as ABTestAssignmentRow[]) ?? [];

  const statsA = { total: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 };
  const statsB = { total: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 };

  for (const row of assignments) {
    const stats = row.variant === 'A' ? statsA : statsB;
    stats.total++;
    if (row.delivered_at) stats.delivered++;
    if (row.opened_at) stats.opened++;
    if (row.clicked_at) stats.clicked++;
    if (row.converted_at) stats.converted++;
  }

  const rateA = statsA.total > 0 ? statsA.converted / statsA.total : 0;
  const rateB = statsB.total > 0 ? statsB.converted / statsB.total : 0;

  const rateDiff = Math.abs(rateA - rateB);
  const isSignificant = rateDiff > 0.05;

  let winner: 'A' | 'B' | null = null;
  if (isSignificant) {
    winner = rateA > rateB ? 'A' : 'B';
  }

  // Persist results back to the AB test record
  const results = {
    variant_a: { ...statsA, rate: rateA },
    variant_b: { ...statsB, rate: rateB },
    winner,
    is_significant: isSignificant,
  };

  await supabase
    .from('ab_tests')
    .update({ results: results as never, winner } as never)
    .eq('id', testId);

  return {
    variantA: { ...statsA, rate: rateA },
    variantB: { ...statsB, rate: rateB },
    winner,
    isSignificant,
  };
}
