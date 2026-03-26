// ============================================================================
// src/lib/crm/tag-categories.ts
// Tag category management service
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---------- Types ----------

export interface TagCategory {
  id: string;
  name: string;
  color: string;
  displayOrder: number;
  createdAt: string;
}

interface TagCategoryRow {
  id: string;
  name: string;
  color: string;
  display_order: number;
  created_at: string;
}

function toTagCategory(row: TagCategoryRow): TagCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  };
}

// ---------- Queries ----------

/** Get all tag categories ordered by display_order */
export async function getTagCategories(): Promise<TagCategory[]> {
  const db = getAdminClient();

  const { data, error } = await db
    .from('tag_categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw new Error(`getTagCategories failed: ${error.message}`);

  return (data as TagCategoryRow[]).map(toTagCategory);
}

/** Create a new tag category */
export async function createTagCategory(input: {
  name: string;
  color: string;
  displayOrder?: number;
}): Promise<TagCategory> {
  const db = getAdminClient();

  const { data, error } = await db
    .from('tag_categories')
    .insert({
      name: input.name,
      color: input.color,
      ...(input.displayOrder !== undefined && {
        display_order: input.displayOrder,
      }),
    } as never)
    .select()
    .single();

  if (error) throw new Error(`createTagCategory failed: ${error.message}`);

  return toTagCategory(data as TagCategoryRow);
}

/** Update an existing tag category */
export async function updateTagCategory(
  id: string,
  input: Partial<{ name: string; color: string; displayOrder: number }>,
): Promise<TagCategory> {
  const db = getAdminClient();

  const updatePayload: Record<string, unknown> = {};
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.color !== undefined) updatePayload.color = input.color;
  if (input.displayOrder !== undefined)
    updatePayload.display_order = input.displayOrder;

  const { data, error } = await db
    .from('tag_categories')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`updateTagCategory failed: ${error.message}`);

  return toTagCategory(data as TagCategoryRow);
}

/** Delete a tag category */
export async function deleteTagCategory(id: string): Promise<void> {
  const db = getAdminClient();

  const { error } = await db
    .from('tag_categories')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`deleteTagCategory failed: ${error.message}`);
}
