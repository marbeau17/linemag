import { getAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScenarioStep {
  type: "wait" | "message" | "condition" | "coupon" | "tag";
  config: Record<string, unknown>;
}

export interface TriggerConfig {
  eventType?: string; // 'follow', 'purchase', 'reservation', 'birthday', etc.
  schedule?: string; // cron expression for scheduled triggers
  delay?: number; // delay in hours after trigger
}

export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  triggerType: "event" | "schedule" | "manual";
  triggerConfig: TriggerConfig;
  steps: ScenarioStep[];
  isActive: boolean;
  targetSegmentId: string | null;
  stats: { sent: number; opened: number; clicked: number };
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioInput {
  name: string;
  description?: string;
  triggerType: "event" | "schedule" | "manual";
  triggerConfig?: TriggerConfig;
  steps?: ScenarioStep[];
  targetSegmentId?: string;
}

export interface ScenarioLog {
  id: string;
  scenarioId: string;
  customerId: string;
  stepIndex: number;
  status: "sent" | "skipped" | "failed" | "pending";
  detail: Record<string, unknown>;
  executedAt: string;
}

// ---------------------------------------------------------------------------
// Row types (snake_case — matches DB columns)
// ---------------------------------------------------------------------------

interface ScenarioRow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: Record<string, unknown>[];
  is_active: boolean;
  target_segment_id: string | null;
  stats: Record<string, unknown>;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ScenarioLogRow {
  id: string;
  scenario_id: string;
  customer_id: string;
  step_index: number;
  status: string;
  detail: Record<string, unknown>;
  executed_at: string;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapScenarioRow(row: ScenarioRow): Scenario {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type as Scenario["triggerType"],
    triggerConfig: (row.trigger_config ?? {}) as TriggerConfig,
    steps: (row.steps as unknown) as ScenarioStep[],
    isActive: row.is_active,
    targetSegmentId: row.target_segment_id,
    stats: {
      sent: (row.stats?.sent as number) ?? 0,
      opened: (row.stats?.opened as number) ?? 0,
      clicked: (row.stats?.clicked as number) ?? 0,
    },
    lastExecutedAt: row.last_executed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScenarioLogRow(row: ScenarioLogRow): ScenarioLog {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    customerId: row.customer_id,
    stepIndex: row.step_index,
    status: row.status as ScenarioLog["status"],
    detail: row.detail ?? {},
    executedAt: row.executed_at,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getScenarios(): Promise<Scenario[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("ma_scenarios")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as ScenarioRow[]).map(mapScenarioRow);
}

export async function getScenarioById(id: string): Promise<Scenario | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("ma_scenarios")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return mapScenarioRow(data as unknown as ScenarioRow);
}

export async function createScenario(
  input: CreateScenarioInput,
): Promise<Scenario> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("ma_scenarios")
    .insert(
      {
        name: input.name,
        description: input.description ?? null,
        trigger_type: input.triggerType,
        trigger_config: (input.triggerConfig ?? {}) as Record<string, unknown>,
        steps: (input.steps as unknown) as Record<string, unknown>[],
        is_active: false,
        target_segment_id: input.targetSegmentId ?? null,
        stats: { sent: 0, opened: 0, clicked: 0 },
      } as never,
    )
    .select("*")
    .single();

  if (error) throw error;
  return mapScenarioRow(data as unknown as ScenarioRow);
}

export async function updateScenario(
  id: string,
  input: Partial<CreateScenarioInput> & { isActive?: boolean },
): Promise<Scenario> {
  const supabase = getAdminClient();

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.triggerType !== undefined) updates.trigger_type = input.triggerType;
  if (input.triggerConfig !== undefined)
    updates.trigger_config = input.triggerConfig;
  if (input.steps !== undefined) updates.steps = input.steps;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  if (input.targetSegmentId !== undefined)
    updates.target_segment_id = input.targetSegmentId;

  const { data, error } = await supabase
    .from("ma_scenarios")
    .update(updates as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapScenarioRow(data as unknown as ScenarioRow);
}

export async function deleteScenario(id: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("ma_scenarios")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function logScenarioExecution(
  scenarioId: string,
  customerId: string,
  stepIndex: number,
  status: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("ma_scenario_logs").insert(
    {
      scenario_id: scenarioId,
      customer_id: customerId,
      step_index: stepIndex,
      status,
      detail: detail ?? {},
    } as never,
  );

  if (error) throw error;
}

export async function getScenarioLogs(
  scenarioId: string,
  limit = 50,
): Promise<ScenarioLog[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("ma_scenario_logs")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as ScenarioLogRow[]).map(mapScenarioLogRow);
}

export async function updateScenarioStats(
  scenarioId: string,
  stats: Partial<{ sent: number; opened: number; clicked: number }>,
): Promise<void> {
  const supabase = getAdminClient();

  // Fetch current stats first so we can merge
  const { data: current, error: fetchError } = await supabase
    .from("ma_scenarios")
    .select("stats")
    .eq("id", scenarioId)
    .single();

  if (fetchError) throw fetchError;

  const existing = (current as unknown as Pick<ScenarioRow, "stats">).stats ?? {
    sent: 0,
    opened: 0,
    clicked: 0,
  };

  const merged = {
    sent: ((existing.sent as number) ?? 0) + (stats.sent ?? 0),
    opened: ((existing.opened as number) ?? 0) + (stats.opened ?? 0),
    clicked: ((existing.clicked as number) ?? 0) + (stats.clicked ?? 0),
  };

  const { error } = await supabase
    .from("ma_scenarios")
    .update({ stats: merged } as never)
    .eq("id", scenarioId);

  if (error) throw error;
}
