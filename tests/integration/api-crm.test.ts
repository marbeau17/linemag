// ============================================================================
// tests/integration/api-crm.test.ts
// Integration tests for CRM API route handlers
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helper to construct NextRequest objects
// ---------------------------------------------------------------------------

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/crm/customers', () => ({
  getCustomers: vi.fn(),
  getCustomerById: vi.fn(),
  updateCustomer: vi.fn(),
  getCustomerCount: vi.fn(),
}));

vi.mock('@/lib/crm/tags', () => ({
  getCustomerTags: vi.fn(),
  addTagToCustomer: vi.fn(),
  removeTagFromCustomer: vi.fn(),
  getAllUniqueTags: vi.fn(),
  getTagCounts: vi.fn(),
}));

vi.mock('@/lib/crm/segments', () => ({
  getSegments: vi.fn(),
  createSegment: vi.fn(),
}));

vi.mock('@/lib/crm/actions', () => ({
  getCustomerActions: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import mocked modules & route handlers
// ---------------------------------------------------------------------------

import {
  getCustomers,
  getCustomerById,
  updateCustomer,
  getCustomerCount,
} from '@/lib/crm/customers';
import {
  getCustomerTags,
  addTagToCustomer,
  removeTagFromCustomer,
  getAllUniqueTags,
  getTagCounts,
} from '@/lib/crm/tags';
import { getSegments, createSegment } from '@/lib/crm/segments';
import { getCustomerActions } from '@/lib/crm/actions';
import { getAdminClient } from '@/lib/supabase/admin';

import { GET as customersGET } from '@/app/api/crm/customers/route';
import {
  GET as customerByIdGET,
  PUT as customerByIdPUT,
} from '@/app/api/crm/customers/[id]/route';
import {
  GET as customerTagsGET,
  POST as customerTagsPOST,
  DELETE as customerTagsDELETE,
} from '@/app/api/crm/customers/[id]/tags/route';
import { GET as customerActionsGET } from '@/app/api/crm/customers/[id]/actions/route';
import { GET as segmentsGET, POST as segmentsPOST } from '@/app/api/crm/segments/route';
import { GET as tagsGET } from '@/app/api/crm/tags/route';
import { GET as statsGET } from '@/app/api/crm/stats/route';
import { GET as customersCountGET } from '@/app/api/crm/customers/count/route';

// ---------------------------------------------------------------------------
// Helper: build route context with promised params (Next.js 15 convention)
// ---------------------------------------------------------------------------

function routeContext(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
});

// ============================================================================
// GET /api/crm/customers
// ============================================================================

describe('GET /api/crm/customers', () => {
  it('returns customer list', async () => {
    const mockResult = {
      data: [{ id: 'c1', display_name: 'Alice' }],
      total: 1,
      page: 1,
      perPage: 20,
    };
    vi.mocked(getCustomers).mockResolvedValue(mockResult);

    const req = createRequest('/api/crm/customers');
    const res = await customersGET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockResult);
    expect(getCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    );
  });

  it('parses query params (page, perPage, search)', async () => {
    vi.mocked(getCustomers).mockResolvedValue({ data: [], total: 0, page: 2, perPage: 10 });

    const req = createRequest('/api/crm/customers?page=2&perPage=10&search=bob');
    await customersGET(req);

    expect(getCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, perPage: 10, search: 'bob' }),
    );
  });
});

// ============================================================================
// GET /api/crm/customers/[id]
// ============================================================================

describe('GET /api/crm/customers/[id]', () => {
  it('returns customer', async () => {
    const customer = { id: 'c1', display_name: 'Alice', line_user_id: 'U123' };
    vi.mocked(getCustomerById).mockResolvedValue(customer as never);

    const req = createRequest('/api/crm/customers/c1');
    const res = await customerByIdGET(req, routeContext({ id: 'c1' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(customer);
  });

  it('returns 404 for non-existent customer', async () => {
    vi.mocked(getCustomerById).mockResolvedValue(null as never);

    const req = createRequest('/api/crm/customers/nonexistent');
    const res = await customerByIdGET(req, routeContext({ id: 'nonexistent' }));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ============================================================================
// PUT /api/crm/customers/[id]
// ============================================================================

describe('PUT /api/crm/customers/[id]', () => {
  it('updates customer', async () => {
    const updated = { id: 'c1', display_name: 'Alice Updated' };
    vi.mocked(updateCustomer).mockResolvedValue(updated as never);

    const req = createRequest('/api/crm/customers/c1', {
      method: 'PUT',
      body: JSON.stringify({ display_name: 'Alice Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await customerByIdPUT(req, routeContext({ id: 'c1' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(updated);
    expect(updateCustomer).toHaveBeenCalledWith('c1', { display_name: 'Alice Updated' });
  });
});

// ============================================================================
// GET /api/crm/customers/[id]/tags
// ============================================================================

describe('GET /api/crm/customers/[id]/tags', () => {
  it('returns tags', async () => {
    vi.mocked(getCustomerTags).mockResolvedValue(['vip', 'new'] as never);

    const req = createRequest('/api/crm/customers/c1/tags');
    const res = await customerTagsGET(req, routeContext({ id: 'c1' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ tags: ['vip', 'new'] });
  });
});

// ============================================================================
// POST /api/crm/customers/[id]/tags
// ============================================================================

describe('POST /api/crm/customers/[id]/tags', () => {
  it('adds tag', async () => {
    vi.mocked(addTagToCustomer).mockResolvedValue(undefined as never);

    const req = createRequest('/api/crm/customers/c1/tags', {
      method: 'POST',
      body: JSON.stringify({ tag: 'vip' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await customerTagsPOST(req, routeContext({ id: 'c1' }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ customerId: 'c1', tag: 'vip' });
    expect(addTagToCustomer).toHaveBeenCalledWith('c1', 'vip');
  });

  it('returns 400 without tag', async () => {
    const req = createRequest('/api/crm/customers/c1/tags', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await customerTagsPOST(req, routeContext({ id: 'c1' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ============================================================================
// DELETE /api/crm/customers/[id]/tags
// ============================================================================

describe('DELETE /api/crm/customers/[id]/tags', () => {
  it('removes tag', async () => {
    vi.mocked(removeTagFromCustomer).mockResolvedValue(undefined as never);

    const req = createRequest('/api/crm/customers/c1/tags?tag=vip', {
      method: 'DELETE',
    });
    const res = await customerTagsDELETE(req, routeContext({ id: 'c1' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(removeTagFromCustomer).toHaveBeenCalledWith('c1', 'vip');
  });
});

// ============================================================================
// GET /api/crm/customers/[id]/actions
// ============================================================================

describe('GET /api/crm/customers/[id]/actions', () => {
  it('returns actions', async () => {
    const mockResult = {
      actions: [{ id: 'a1', action_type: 'message', created_at: '2026-01-01' }],
      total: 1,
    };
    vi.mocked(getCustomerActions).mockResolvedValue(mockResult as never);

    const req = createRequest('/api/crm/customers/c1/actions');
    const res = await customerActionsGET(req, routeContext({ id: 'c1' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockResult);
    expect(getCustomerActions).toHaveBeenCalledWith('c1', {
      limit: 50,
      offset: 0,
      actionType: undefined,
    });
  });
});

// ============================================================================
// GET /api/crm/segments
// ============================================================================

describe('GET /api/crm/segments', () => {
  it('returns segments', async () => {
    const segments = [{ id: 's1', name: 'VIPs', type: 'manual' }];
    vi.mocked(getSegments).mockResolvedValue(segments as never);

    const res = await segmentsGET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ segments });
  });
});

// ============================================================================
// POST /api/crm/segments
// ============================================================================

describe('POST /api/crm/segments', () => {
  it('creates segment', async () => {
    const segment = { id: 's2', name: 'New Users', type: 'dynamic' };
    vi.mocked(createSegment).mockResolvedValue(segment as never);

    const req = createRequest('/api/crm/segments', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Users', type: 'dynamic' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await segmentsPOST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ segment });
    expect(createSegment).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Users', type: 'dynamic' }),
    );
  });
});

// ============================================================================
// GET /api/crm/tags
// ============================================================================

describe('GET /api/crm/tags', () => {
  it('returns tags with counts', async () => {
    vi.mocked(getAllUniqueTags).mockResolvedValue(['vip', 'new'] as never);
    vi.mocked(getTagCounts).mockResolvedValue({ vip: 5, new: 3 } as never);

    const res = await tagsGET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ tags: ['vip', 'new'], counts: { vip: 5, new: 3 } });
  });
});

// ============================================================================
// GET /api/crm/stats
// ============================================================================

describe('GET /api/crm/stats', () => {
  it('returns stats', async () => {
    // Build a chainable mock that simulates the Supabase query builder
    const mockChain = () => {
      const chain: Record<string, unknown> = {};
      const self = new Proxy(chain, {
        get(_target, prop) {
          if (prop === 'then') return undefined; // makes it awaitable later
          return (..._args: unknown[]) => self;
        },
      });
      return self;
    };

    // We need to return specific results for each Promise.all entry.
    // The stats route calls getAdminClient().from(...) six times.
    // Each chain is awaited to produce { data, count, error }.
    const callResults = [
      { data: null, count: 100, error: null },       // totalCustomers
      { data: null, count: 5, error: null },          // newCustomersThisMonth
      { data: [{ membership_tier: 'gold' }, { membership_tier: 'gold' }, { membership_tier: 'silver' }], count: null, error: null }, // tierBreakdown
      { data: null, count: 80, error: null },         // activeCustomers
      { data: [{ tag: 'vip' }, { tag: 'vip' }, { tag: 'new' }], count: null, error: null }, // topTags
      { data: null, count: 3, error: null },          // segmentCount
    ];

    let callIndex = 0;

    // Create a mock Supabase client with a chainable builder
    const mockDb = {
      from: vi.fn().mockImplementation(() => {
        const idx = callIndex++;
        const result = callResults[idx] ?? { data: null, count: 0, error: null };

        const handler: ProxyHandler<object> = {
          get(_target, prop) {
            if (prop === 'then') {
              // Make it thenable — resolve with the mocked result
              return (resolve: (v: unknown) => void) => resolve(result);
            }
            // Any other method call returns the proxy itself (chaining)
            return () => proxy;
          },
        };
        const proxy: object = new Proxy({}, handler);
        return proxy;
      }),
    };

    vi.mocked(getAdminClient).mockReturnValue(mockDb as never);

    const res = await statsGET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      totalCustomers: 100,
      newCustomersThisMonth: 5,
      activeCustomers: 80,
      segmentCount: 3,
      tierBreakdown: { gold: 2, silver: 1 },
      topTags: [
        { tag: 'vip', count: 2 },
        { tag: 'new', count: 1 },
      ],
    });
  });
});

// ============================================================================
// GET /api/crm/customers/count
// ============================================================================

describe('GET /api/crm/customers/count', () => {
  it('returns count', async () => {
    vi.mocked(getCustomerCount).mockResolvedValue(42 as never);

    const res = await customersCountGET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ count: 42 });
  });
});
