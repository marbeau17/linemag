import { vi } from 'vitest';

// Create a chainable mock that simulates Supabase query builder
function createQueryBuilder(data: any[] = [], error: any = null) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then: vi.fn((resolve: any) => resolve({ data, error, count: data.length })),
  };

  // Make the builder itself thenable (Promise-like)
  return new Proxy(builder, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: any) => resolve({ data, error, count: data.length });
      }
      return target[prop] || vi.fn().mockReturnValue(target);
    },
  });
}

export function createMockSupabaseClient(tableData: Record<string, any[]> = {}) {
  return {
    from: vi.fn((table: string) => createQueryBuilder(tableData[table] || [])),
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

// Mock the admin client module
export function mockAdminClient(tableData: Record<string, any[]> = {}) {
  const client = createMockSupabaseClient(tableData);
  vi.mock('@/lib/supabase/admin', () => ({
    getAdminClient: () => client,
  }));
  return client;
}
