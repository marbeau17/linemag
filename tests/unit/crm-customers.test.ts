// ============================================================================
// tests/unit/crm-customers.test.ts
// Unit tests for src/lib/crm/customers.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Chainable Supabase query builder mock
// ---------------------------------------------------------------------------

interface MockQueryState {
  table: string;
  method: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | null;
  filters: Array<{ type: string; args: unknown[] }>;
  selectArgs: unknown[];
  orderArgs: unknown[];
  rangeArgs: unknown[];
  singleMode: 'single' | 'maybeSingle' | null;
}

/**
 * Creates a chainable mock that mimics the Supabase PostgREST query builder.
 *
 * `resolveWith` is called when the chain is awaited (or when `.single()` /
 * `.maybeSingle()` is called) and should return `{ data, error, count }`.
 */
function createMockQueryBuilder(
  resolveWith: (state: MockQueryState) => {
    data: unknown;
    error: unknown;
    count?: number | null;
  },
) {
  const state: MockQueryState = {
    table: '',
    method: null,
    filters: [],
    selectArgs: [],
    orderArgs: [],
    rangeArgs: [],
    singleMode: null,
  };

  const result = () => resolveWith(state);

  const builder: Record<string, unknown> = {};

  // Every chainable method returns the same builder so calls can be chained.
  const chainable = (name: string, handler?: (...args: unknown[]) => void) => {
    builder[name] = vi.fn((...args: unknown[]) => {
      handler?.(...args);
      return builder;
    });
  };

  // --- query-starting methods (from / select / insert / update / upsert) ---
  chainable('select', (...args: unknown[]) => {
    state.method = 'select';
    state.selectArgs = args;
  });
  chainable('insert', () => {
    state.method = 'insert';
  });
  chainable('update', () => {
    state.method = 'update';
  });
  chainable('upsert', () => {
    state.method = 'upsert';
  });
  chainable('delete', () => {
    state.method = 'delete';
  });

  // --- filters ---
  chainable('eq', (...args: unknown[]) => {
    state.filters.push({ type: 'eq', args });
  });
  chainable('neq', (...args: unknown[]) => {
    state.filters.push({ type: 'neq', args });
  });
  chainable('ilike', (...args: unknown[]) => {
    state.filters.push({ type: 'ilike', args });
  });
  chainable('or', (...args: unknown[]) => {
    state.filters.push({ type: 'or', args });
  });
  chainable('contains', (...args: unknown[]) => {
    state.filters.push({ type: 'contains', args });
  });

  // --- ordering / pagination ---
  chainable('order', (...args: unknown[]) => {
    state.orderArgs = args;
  });
  chainable('range', (...args: unknown[]) => {
    state.rangeArgs = args;
  });
  chainable('limit');

  // --- terminal modifiers ---
  // single / maybeSingle still return a thenable so the `await` resolves.
  builder.single = vi.fn(() => {
    state.singleMode = 'single';
    return { ...builder, then: (resolve: (v: unknown) => void) => resolve(result()) };
  });
  builder.maybeSingle = vi.fn(() => {
    state.singleMode = 'maybeSingle';
    return { ...builder, then: (resolve: (v: unknown) => void) => resolve(result()) };
  });

  // Make the builder itself thenable so `await query` works (for list queries).
  builder.then = (resolve: (v: unknown) => void) => resolve(result());

  return { builder, state };
}

// ---------------------------------------------------------------------------
// Module-level mock wiring
// ---------------------------------------------------------------------------

// We hold a reference to the *current* resolver so each test can customise it.
let currentResolver: (state: MockQueryState) => {
  data: unknown;
  error: unknown;
  count?: number | null;
};

// Track the most recent query state for assertions.
let lastQueryState: MockQueryState;

const mockFrom = vi.fn((_table: string) => {
  const { builder, state } = createMockQueryBuilder((s) => {
    lastQueryState = s;
    return currentResolver(s);
  });
  state.table = _table;
  return builder;
});

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: mockFrom,
  }),
}));

// Import AFTER mocking so the mock takes effect.
import {
  getCustomers,
  getCustomerById,
  getCustomerByLineUserId,
  upsertCustomerByLineUserId,
  updateCustomer,
  getCustomerCount,
} from '@/lib/crm/customers';

// ---------------------------------------------------------------------------
// Helpers — sample DB rows
// ---------------------------------------------------------------------------

function makeCustomerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust-001',
    line_user_id: 'U1234567890abcdef',
    display_name: 'Taro Yamada',
    picture_url: 'https://example.com/pic.jpg',
    status_message: 'Hello!',
    email: 'taro@example.com',
    phone: '090-1234-5678',
    gender: 'male',
    birth_date: '1990-01-15',
    prefecture: 'Tokyo',
    membership_tier: 'gold',
    message_count: 42,
    first_seen_at: '2025-01-01T00:00:00Z',
    last_seen_at: '2025-06-01T12:00:00Z',
    blocked_at: null,
    attributes: { tags: ['vip'] },
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-01T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CRM customers service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default resolver: return empty success so tests that forget to set it
    // don't hang.
    currentResolver = () => ({ data: [], error: null, count: 0 });
  });

  // -------------------------------------------------------------------------
  // getCustomers
  // -------------------------------------------------------------------------

  describe('getCustomers()', () => {
    it('returns paginated customer list with correct mapping', async () => {
      const row = makeCustomerRow();
      currentResolver = () => ({ data: [row], error: null, count: 1 });

      const result = await getCustomers({ page: 1, perPage: 10 });

      // Verify table
      expect(mockFrom).toHaveBeenCalledWith('customers');

      // Verify returned shape
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(10);
      expect(result.total).toBe(1);
      expect(result.customers).toHaveLength(1);

      // Verify snake_case -> camelCase mapping
      const c = result.customers[0];
      expect(c.id).toBe('cust-001');
      expect(c.lineUserId).toBe('U1234567890abcdef');
      expect(c.displayName).toBe('Taro Yamada');
      expect(c.pictureUrl).toBe('https://example.com/pic.jpg');
      expect(c.statusMessage).toBe('Hello!');
      expect(c.email).toBe('taro@example.com');
      expect(c.phone).toBe('090-1234-5678');
      expect(c.gender).toBe('male');
      expect(c.birthDate).toBe('1990-01-15');
      expect(c.prefecture).toBe('Tokyo');
      expect(c.membershipTier).toBe('gold');
      expect(c.messageCount).toBe(42);
      expect(c.firstSeenAt).toBe('2025-01-01T00:00:00Z');
      expect(c.lastSeenAt).toBe('2025-06-01T12:00:00Z');
      expect(c.blockedAt).toBeNull();
      expect(c.attributes).toEqual({ tags: ['vip'] });
      expect(c.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(c.updatedAt).toBe('2025-06-01T12:00:00Z');
    });

    it('applies search filter via or()', async () => {
      currentResolver = () => ({ data: [], error: null, count: 0 });

      await getCustomers({ search: 'taro' });

      // The implementation builds an `.or(...)` filter.
      const queryBuilder = mockFrom.mock.results[0].value;
      expect(queryBuilder.or).toHaveBeenCalledWith(
        'display_name.ilike.%taro%,email.ilike.%taro%',
      );
    });

    it('applies tier filter via eq()', async () => {
      currentResolver = () => ({ data: [], error: null, count: 0 });

      await getCustomers({ tier: 'gold' });

      const queryBuilder = mockFrom.mock.results[0].value;
      expect(queryBuilder.eq).toHaveBeenCalledWith('membership_tier', 'gold');
    });

    it('throws on Supabase error', async () => {
      currentResolver = () => ({
        data: null,
        error: { message: 'connection failed' },
        count: null,
      });

      await expect(getCustomers()).rejects.toThrow('Failed to fetch customers: connection failed');
    });
  });

  // -------------------------------------------------------------------------
  // getCustomerById
  // -------------------------------------------------------------------------

  describe('getCustomerById()', () => {
    it('returns customer when found', async () => {
      const row = makeCustomerRow();
      currentResolver = () => ({ data: row, error: null });

      const result = await getCustomerById('cust-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('cust-001');
      expect(result!.lineUserId).toBe('U1234567890abcdef');

      const queryBuilder = mockFrom.mock.results[0].value;
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'cust-001');
      expect(queryBuilder.maybeSingle).toHaveBeenCalled();
    });

    it('returns null when not found', async () => {
      currentResolver = () => ({ data: null, error: null });

      const result = await getCustomerById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getCustomerByLineUserId
  // -------------------------------------------------------------------------

  describe('getCustomerByLineUserId()', () => {
    it('finds customer by LINE user ID', async () => {
      const row = makeCustomerRow();
      currentResolver = () => ({ data: row, error: null });

      const result = await getCustomerByLineUserId('U1234567890abcdef');

      expect(result).not.toBeNull();
      expect(result!.lineUserId).toBe('U1234567890abcdef');

      const queryBuilder = mockFrom.mock.results[0].value;
      expect(queryBuilder.eq).toHaveBeenCalledWith('line_user_id', 'U1234567890abcdef');
      expect(queryBuilder.maybeSingle).toHaveBeenCalled();
    });

    it('returns null when LINE user ID not found', async () => {
      currentResolver = () => ({ data: null, error: null });

      const result = await getCustomerByLineUserId('Unonexistent');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // upsertCustomerByLineUserId
  // -------------------------------------------------------------------------

  describe('upsertCustomerByLineUserId()', () => {
    it('creates a new customer', async () => {
      const row = makeCustomerRow();
      currentResolver = () => ({ data: row, error: null });

      const result = await upsertCustomerByLineUserId('U1234567890abcdef', {
        displayName: 'Taro Yamada',
        email: 'taro@example.com',
      });

      expect(result.lineUserId).toBe('U1234567890abcdef');
      expect(result.displayName).toBe('Taro Yamada');

      const queryBuilder = mockFrom.mock.results[0].value;
      expect(queryBuilder.upsert).toHaveBeenCalled();

      // Verify the upsert payload contains snake_case keys
      const upsertCall = queryBuilder.upsert.mock.calls[0];
      const payload = upsertCall[0];
      expect(payload.line_user_id).toBe('U1234567890abcdef');
      expect(payload.display_name).toBe('Taro Yamada');
      expect(payload.email).toBe('taro@example.com');
      expect(payload.updated_at).toBeDefined();

      // Verify onConflict option
      const options = upsertCall[1];
      expect(options).toEqual({ onConflict: 'line_user_id' });

      expect(queryBuilder.single).toHaveBeenCalled();
    });

    it('updates an existing customer', async () => {
      const row = makeCustomerRow({
        display_name: 'Taro Updated',
        membership_tier: 'platinum',
      });
      currentResolver = () => ({ data: row, error: null });

      const result = await upsertCustomerByLineUserId('U1234567890abcdef', {
        displayName: 'Taro Updated',
        membershipTier: 'platinum',
      });

      expect(result.displayName).toBe('Taro Updated');
      expect(result.membershipTier).toBe('platinum');

      const queryBuilder = mockFrom.mock.results[0].value;
      const payload = queryBuilder.upsert.mock.calls[0][0];
      expect(payload.display_name).toBe('Taro Updated');
      expect(payload.membership_tier).toBe('platinum');
    });

    it('throws on Supabase error', async () => {
      currentResolver = () => ({
        data: null,
        error: { message: 'conflict' },
      });

      await expect(
        upsertCustomerByLineUserId('Ufail', { displayName: 'Fail' }),
      ).rejects.toThrow('Failed to upsert customer for line_user_id Ufail: conflict');
    });
  });

  // -------------------------------------------------------------------------
  // updateCustomer
  // -------------------------------------------------------------------------

  describe('updateCustomer()', () => {
    it('updates fields and sets updated_at', async () => {
      const row = makeCustomerRow({ email: 'new@example.com' });
      currentResolver = () => ({ data: row, error: null });

      const result = await updateCustomer('cust-001', {
        email: 'new@example.com',
        phone: '080-9999-0000',
      });

      expect(result.id).toBe('cust-001');

      const queryBuilder = mockFrom.mock.results[0].value;
      expect(queryBuilder.update).toHaveBeenCalled();

      const payload = queryBuilder.update.mock.calls[0][0];
      expect(payload.email).toBe('new@example.com');
      expect(payload.phone).toBe('080-9999-0000');
      expect(payload.updated_at).toBeDefined();
      // updated_at should be an ISO string
      expect(() => new Date(payload.updated_at as string)).not.toThrow();

      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'cust-001');
      expect(queryBuilder.single).toHaveBeenCalled();
    });

    it('throws on Supabase error', async () => {
      currentResolver = () => ({
        data: null,
        error: { message: 'not found' },
      });

      await expect(updateCustomer('cust-bad', { email: 'x' })).rejects.toThrow(
        'Failed to update customer cust-bad: not found',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getCustomerCount
  // -------------------------------------------------------------------------

  describe('getCustomerCount()', () => {
    it('returns count using head query', async () => {
      currentResolver = () => ({ data: null, error: null, count: 150 });

      const count = await getCustomerCount();

      expect(count).toBe(150);

      expect(mockFrom).toHaveBeenCalledWith('customers');
      const queryBuilder = mockFrom.mock.results[0].value;
      expect(queryBuilder.select).toHaveBeenCalledWith('*', {
        count: 'exact',
        head: true,
      });
    });

    it('returns 0 when count is null', async () => {
      currentResolver = () => ({ data: null, error: null, count: null });

      const count = await getCustomerCount();

      expect(count).toBe(0);
    });

    it('throws on Supabase error', async () => {
      currentResolver = () => ({
        data: null,
        error: { message: 'timeout' },
        count: null,
      });

      await expect(getCustomerCount()).rejects.toThrow(
        'Failed to count customers: timeout',
      );
    });
  });
});
