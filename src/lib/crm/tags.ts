// ============================================================================
// src/lib/crm/tags.ts
// Customer tag management service
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---------- Types ----------

export interface CustomerTag {
  id: string;
  customerId: string;
  tag: string;
  createdAt: string;
}

interface CustomerTagRow {
  id: string;
  customer_id: string;
  tag: string;
  created_at: string;
}

function toCustomerTag(row: CustomerTagRow): CustomerTag {
  return {
    id: row.id,
    customerId: row.customer_id,
    tag: row.tag,
    createdAt: row.created_at,
  };
}

// ---------- Queries ----------

/** Get all tags for a customer */
export async function getCustomerTags(
  customerId: string,
): Promise<CustomerTag[]> {
  const db = getAdminClient();

  const { data, error } = await db
    .from('customer_tags')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`getCustomerTags failed: ${error.message}`);

  return (data as CustomerTagRow[]).map(toCustomerTag);
}

/** Add a tag to a customer (ignore if already exists) */
export async function addTagToCustomer(
  customerId: string,
  tag: string,
): Promise<void> {
  const db = getAdminClient();

  const { error } = await db
    .from('customer_tags')
    .upsert(
      { customer_id: customerId, tag } as never,
      { onConflict: 'customer_id,tag' },
    );

  if (error) throw new Error(`addTagToCustomer failed: ${error.message}`);
}

/** Remove a tag from a customer */
export async function removeTagFromCustomer(
  customerId: string,
  tag: string,
): Promise<void> {
  const db = getAdminClient();

  const { error } = await db
    .from('customer_tags')
    .delete()
    .eq('customer_id', customerId)
    .eq('tag', tag);

  if (error) throw new Error(`removeTagFromCustomer failed: ${error.message}`);
}

/** Bulk add tags to a customer */
export async function bulkAddTags(
  customerId: string,
  tags: string[],
): Promise<void> {
  if (tags.length === 0) return;

  const db = getAdminClient();

  const rows = tags.map((tag) => ({ customer_id: customerId, tag }));

  const { error } = await db
    .from('customer_tags')
    .upsert(rows as never, { onConflict: 'customer_id,tag' });

  if (error) throw new Error(`bulkAddTags failed: ${error.message}`);
}

/** Get all unique tags used across all customers (for autocomplete) */
export async function getAllUniqueTags(): Promise<string[]> {
  const db = getAdminClient();

  const { data, error } = await db
    .from('customer_tags')
    .select('tag')
    .order('tag', { ascending: true });

  if (error) throw new Error(`getAllUniqueTags failed: ${error.message}`);

  const unique = Array.from(new Set((data as { tag: string }[]).map((r) => r.tag)));
  return unique;
}

/** Get customer IDs that have a given tag */
export async function getCustomerIdsByTag(tag: string): Promise<string[]> {
  const db = getAdminClient();

  const { data, error } = await db
    .from('customer_tags')
    .select('customer_id')
    .eq('tag', tag);

  if (error) throw new Error(`getCustomerIdsByTag failed: ${error.message}`);

  return (data as { customer_id: string }[]).map((r) => r.customer_id);
}

/** Get tag counts (how many customers per tag) */
export async function getTagCounts(): Promise<{ tag: string; count: number }[]> {
  const db = getAdminClient();

  // Supabase JS v2 does not support GROUP BY directly, so we fetch all rows
  // and aggregate in JS. For large datasets consider an RPC / database view.
  const { data, error } = await db
    .from('customer_tags')
    .select('tag');

  if (error) throw new Error(`getTagCounts failed: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data as { tag: string }[]) {
    counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
