// ============================================================================
// src/lib/crm/actions.ts
// 顧客アクション・イベントトラッキング
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export type ActionType =
  | 'message_received'
  | 'link_tap'
  | 'purchase'
  | 'follow'
  | 'unfollow'
  | 'coupon_use'
  | 'reservation'
  | 'page_view';

export interface CustomerAction {
  id: string;
  customerId: string;
  actionType: ActionType;
  actionDetail: Record<string, unknown>;
  source: string | null;
  actedAt: string;
}

export interface TrackActionInput {
  customerId: string;
  actionType: ActionType;
  actionDetail?: Record<string, unknown>;
  source?: string;
}

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): CustomerAction {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    actionType: row.action_type as ActionType,
    actionDetail: (row.action_detail as Record<string, unknown>) ?? {},
    source: (row.source as string) ?? null,
    actedAt: row.acted_at as string,
  };
}

// ─── アクション記録 ──────────────────────────────────────────────────────────

/** Track a new action */
export async function trackAction(input: TrackActionInput): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase.from('customer_actions').insert({
    customer_id: input.customerId,
    action_type: input.actionType,
    action_detail: input.actionDetail ?? {},
    source: input.source ?? null,
  } as never);

  if (error) {
    throw new Error(`Failed to track action: ${error.message}`);
  }
}

// ─── 顧客別アクション取得（ページネーション対応・新しい順） ───────────────────

/** Get actions for a customer (paginated, newest first) */
export async function getCustomerActions(
  customerId: string,
  options?: {
    limit?: number;
    offset?: number;
    actionType?: ActionType;
  },
): Promise<CustomerAction[]> {
  const supabase = getAdminClient();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from('customer_actions')
    .select('*')
    .eq('customer_id', customerId)
    .order('acted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.actionType) {
    query = query.eq('action_type', options.actionType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch customer actions: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

// ─── 顧客別アクション件数 ──────────────────────────────────────────────────

/** Get action count for a customer */
export async function getActionCount(
  customerId: string,
  actionType?: ActionType,
): Promise<number> {
  const supabase = getAdminClient();

  let query = supabase
    .from('customer_actions')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId);

  if (actionType) {
    query = query.eq('action_type', actionType);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count actions: ${error.message}`);
  }

  return count ?? 0;
}

// ─── 全顧客の最新アクション（管理ダッシュボード用） ─────────────────────────

/** Get recent actions across all customers (for admin dashboard) */
export async function getRecentActions(
  limit = 50,
): Promise<(CustomerAction & { displayName?: string })[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('customer_actions')
    .select('*, customers(display_name)')
    .order('acted_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent actions: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const customers = row.customers as
      | { display_name: string | null }
      | null;

    return {
      ...mapRow(row),
      displayName: customers?.display_name ?? undefined,
    };
  });
}
