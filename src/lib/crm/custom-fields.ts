// ============================================================================
// src/lib/crm/custom-fields.ts
// Custom field definitions and per-customer field values
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomFieldDefinition {
  id: string;
  name: string;
  fieldKey: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  options: string[]; // for select/multiselect
  isRequired: boolean;
  displayOrder: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldValue {
  id: string;
  customerId: string;
  fieldId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueJson: unknown;
  valueBoolean: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFieldInput {
  name: string;
  fieldKey: string;
  fieldType: string;
  options?: string[];
  isRequired?: boolean;
  displayOrder?: number;
  description?: string;
}

// ---------------------------------------------------------------------------
// DB row shapes (snake_case)
// ---------------------------------------------------------------------------

interface DefinitionRow {
  id: string;
  name: string;
  field_key: string;
  field_type: string;
  options: string[];
  is_required: boolean;
  display_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface ValueRow {
  id: string;
  customer_id: string;
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_json: unknown;
  value_boolean: boolean | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Row <-> Model mapping
// ---------------------------------------------------------------------------

function rowToDefinition(row: DefinitionRow): CustomFieldDefinition {
  return {
    id: row.id,
    name: row.name,
    fieldKey: row.field_key,
    fieldType: row.field_type as CustomFieldDefinition['fieldType'],
    options: row.options ?? [],
    isRequired: row.is_required,
    displayOrder: row.display_order,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToValue(row: ValueRow): CustomFieldValue {
  return {
    id: row.id,
    customerId: row.customer_id,
    fieldId: row.field_id,
    valueText: row.value_text,
    valueNumber: row.value_number,
    valueDate: row.value_date,
    valueJson: row.value_json,
    valueBoolean: row.value_boolean,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Definition CRUD
// ---------------------------------------------------------------------------

/**
 * List all custom field definitions ordered by display_order.
 */
export async function getFieldDefinitions(): Promise<CustomFieldDefinition[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data as DefinitionRow[]).map(rowToDefinition);
}

/**
 * Get a single field definition by ID.
 */
export async function getFieldDefinitionById(
  id: string,
): Promise<CustomFieldDefinition | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToDefinition(data as DefinitionRow);
}

/**
 * Create a new custom field definition.
 */
export async function createFieldDefinition(
  input: CreateFieldInput,
): Promise<CustomFieldDefinition> {
  const supabase = getAdminClient();

  const row = {
    name: input.name,
    field_key: input.fieldKey,
    field_type: input.fieldType,
    options: input.options ?? [],
    is_required: input.isRequired ?? false,
    display_order: input.displayOrder ?? 0,
    description: input.description ?? null,
  };

  const { data, error } = await supabase
    .from('custom_field_definitions')
    .insert(row as never)
    .select()
    .single();

  if (error) throw error;
  return rowToDefinition(data as DefinitionRow);
}

/**
 * Update an existing custom field definition.
 */
export async function updateFieldDefinition(
  id: string,
  input: Partial<CreateFieldInput>,
): Promise<CustomFieldDefinition> {
  const supabase = getAdminClient();

  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.fieldKey !== undefined) row.field_key = input.fieldKey;
  if (input.fieldType !== undefined) row.field_type = input.fieldType;
  if (input.options !== undefined) row.options = input.options;
  if (input.isRequired !== undefined) row.is_required = input.isRequired;
  if (input.displayOrder !== undefined) row.display_order = input.displayOrder;
  if (input.description !== undefined) row.description = input.description;

  const { data, error } = await supabase
    .from('custom_field_definitions')
    .update(row as never)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToDefinition(data as DefinitionRow);
}

/**
 * Delete a custom field definition (and its associated values via cascade).
 */
export async function deleteFieldDefinition(id: string): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('custom_field_definitions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Customer field values
// ---------------------------------------------------------------------------

/**
 * Get all custom field values for a customer, joined with their definitions.
 */
export async function getCustomerFieldValues(
  customerId: string,
): Promise<(CustomFieldValue & { definition: CustomFieldDefinition })[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('custom_field_values')
    .select('*, custom_field_definitions(*)')
    .eq('customer_id', customerId);

  if (error) throw error;

  return ((data ?? []) as (ValueRow & { custom_field_definitions: DefinitionRow })[]).map(
    (row) => ({
      ...rowToValue(row),
      definition: rowToDefinition(row.custom_field_definitions),
    }),
  );
}

/**
 * Set (upsert) a custom field value for a customer.
 */
export async function setCustomerFieldValue(
  customerId: string,
  fieldId: string,
  value: {
    text?: string;
    number?: number;
    date?: string;
    json?: unknown;
    boolean?: boolean;
  },
): Promise<void> {
  const supabase = getAdminClient();

  const row = {
    customer_id: customerId,
    field_id: fieldId,
    value_text: value.text ?? null,
    value_number: value.number ?? null,
    value_date: value.date ?? null,
    value_json: value.json ?? null,
    value_boolean: value.boolean ?? null,
  };

  const { error } = await supabase
    .from('custom_field_values')
    .upsert(row as never, {
      onConflict: 'customer_id,field_id',
    });

  if (error) throw error;
}

/**
 * Delete a custom field value for a customer.
 */
export async function deleteCustomerFieldValue(
  customerId: string,
  fieldId: string,
): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('custom_field_values')
    .delete()
    .eq('customer_id', customerId)
    .eq('field_id', fieldId);

  if (error) throw error;
}
