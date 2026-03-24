import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/admin
// ---------------------------------------------------------------------------

const mockSupabase = createMockSupabaseClient();

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => mockSupabase,
}));

// ---------------------------------------------------------------------------
// Import modules under test (after mock registration)
// ---------------------------------------------------------------------------

import {
  getCouponMasters,
  getCouponMasterById,
  getCouponMasterByCode,
  createCouponMaster,
  updateCouponMaster,
  deleteCouponMaster,
  getCouponMasterCount,
} from '@/lib/coupon/masters';

import {
  issueCoupon,
  batchIssueCoupon,
  getCustomerCoupons,
  getCouponIssues,
  useCoupon,
  revokeCoupon,
  getCouponStats,
} from '@/lib/coupon/issues';

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

function createMockSupabaseClient() {
  // Each chain-method returns `chain` so calls can be chained freely.
  // The terminal methods (awaited by the source) resolve via `_result`.
  const chain: Record<string, any> = {};
  let _result: any = { data: null, error: null, count: null };

  const reset = () => {
    _result = { data: null, error: null, count: null };
  };

  const setResult = (r: any) => {
    _result = r;
  };

  // Every chaining method returns the same `chain` proxy and is a vi.fn()
  // so tests can inspect call args.
  const methods = [
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
    'single',
    'maybeSingle',
  ];

  for (const m of methods) {
    chain[m] = vi.fn((..._args: any[]) => chain);
  }

  // Make `chain` thenable so `await query` resolves to `_result`.
  // Store as a named function so it can be restored after tests that override it.
  const defaultThen = (resolve: any) => resolve(_result);
  chain.then = defaultThen;

  chain.__setResult = setResult;
  chain.__reset = reset;
  chain.__restoreThen = () => { chain.then = defaultThen; };

  return chain;
}

// ---------------------------------------------------------------------------
// Sample data factories
// ---------------------------------------------------------------------------

function makeMasterRow(overrides: Record<string, any> = {}) {
  return {
    id: 'master-1',
    code: 'SPRING2026',
    name: 'Spring Sale',
    description: 'Spring discount',
    discount_type: 'fixed',
    discount_value: 500,
    min_purchase_amount: 1000,
    max_issues: null,
    max_uses_per_customer: 1,
    valid_from: '2026-03-01T00:00:00Z',
    valid_until: '2026-04-01T00:00:00Z',
    is_active: true,
    target_segment_id: null,
    metadata: {},
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function makeIssueRow(overrides: Record<string, any> = {}) {
  return {
    id: 'issue-1',
    coupon_master_id: 'master-1',
    customer_id: 'cust-1',
    issue_code: 'SPRING2026-A1B2C3',
    status: 'issued',
    issued_at: '2026-03-10T00:00:00Z',
    expires_at: '2026-04-01T00:00:00Z',
    used_at: null,
    created_at: '2026-03-10T00:00:00Z',
    ...overrides,
  };
}

function makeUsageRow(overrides: Record<string, any> = {}) {
  return {
    id: 'usage-1',
    coupon_issue_id: 'issue-1',
    customer_id: 'cust-1',
    discount_amount: 500,
    used_at: '2026-03-15T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSupabase.__reset();
  mockSupabase.__restoreThen();
  for (const key of Object.keys(mockSupabase)) {
    if (typeof mockSupabase[key]?.mockClear === 'function') {
      mockSupabase[key].mockClear();
    }
  }
});

// ===========================================================================
// Masters tests
// ===========================================================================

describe('coupon masters', () => {
  // 1. getCouponMasters — returns all masters with mapping
  it('getCouponMasters() returns all masters mapped to camelCase', async () => {
    const row = makeMasterRow();
    mockSupabase.__setResult({ data: [row], error: null });

    const result = await getCouponMasters();

    expect(mockSupabase.from).toHaveBeenCalledWith('coupon_masters');
    expect(mockSupabase.select).toHaveBeenCalledWith('*');
    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'master-1',
      code: 'SPRING2026',
      name: 'Spring Sale',
      description: 'Spring discount',
      discountType: 'fixed',
      discountValue: 500,
      minPurchaseAmount: 1000,
      maxIssues: null,
      maxUsesPerCustomer: 1,
      validFrom: '2026-03-01T00:00:00Z',
      validUntil: '2026-04-01T00:00:00Z',
      isActive: true,
      targetSegmentId: null,
      metadata: {},
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    });
  });

  // 2. getCouponMasters({ activeOnly: true }) — filters by is_active
  it('getCouponMasters({ activeOnly: true }) applies is_active filter', async () => {
    const row = makeMasterRow();
    mockSupabase.__setResult({ data: [row], error: null });

    await getCouponMasters({ activeOnly: true });

    expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true);
  });

  // 3. getCouponMasterById — returns master by ID
  it('getCouponMasterById() returns master by ID', async () => {
    const row = makeMasterRow();
    mockSupabase.__setResult({ data: row, error: null });

    const result = await getCouponMasterById('master-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('coupon_masters');
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'master-1');
    expect(mockSupabase.maybeSingle).toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.id).toBe('master-1');
  });

  // 4. getCouponMasterByCode — returns master by code
  it('getCouponMasterByCode() returns master by code', async () => {
    const row = makeMasterRow();
    mockSupabase.__setResult({ data: row, error: null });

    const result = await getCouponMasterByCode('SPRING2026');

    expect(mockSupabase.eq).toHaveBeenCalledWith('code', 'SPRING2026');
    expect(mockSupabase.maybeSingle).toHaveBeenCalled();
    expect(result!.code).toBe('SPRING2026');
  });

  // 5. createCouponMaster — creates with correct fields
  it('createCouponMaster() inserts row with mapped fields', async () => {
    const row = makeMasterRow();
    mockSupabase.__setResult({ data: row, error: null });

    const input = {
      code: 'SPRING2026',
      name: 'Spring Sale',
      description: 'Spring discount',
      discountType: 'fixed' as const,
      discountValue: 500,
      minPurchaseAmount: 1000,
      validFrom: '2026-03-01T00:00:00Z',
      validUntil: '2026-04-01T00:00:00Z',
    };

    const result = await createCouponMaster(input);

    expect(mockSupabase.from).toHaveBeenCalledWith('coupon_masters');
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SPRING2026',
        name: 'Spring Sale',
        discount_type: 'fixed',
        discount_value: 500,
        min_purchase_amount: 1000,
        valid_from: '2026-03-01T00:00:00Z',
        valid_until: '2026-04-01T00:00:00Z',
      }),
    );
    expect(mockSupabase.single).toHaveBeenCalled();
    expect(result.code).toBe('SPRING2026');
  });

  // 6. updateCouponMaster — updates fields
  it('updateCouponMaster() updates mapped fields', async () => {
    const row = makeMasterRow({ name: 'Updated Sale', is_active: false });
    mockSupabase.__setResult({ data: row, error: null });

    const result = await updateCouponMaster('master-1', {
      name: 'Updated Sale',
      isActive: false,
    });

    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Sale',
        is_active: false,
      }),
    );
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'master-1');
    expect(result.name).toBe('Updated Sale');
  });

  // 7. deleteCouponMaster — deletes
  it('deleteCouponMaster() deletes by ID', async () => {
    mockSupabase.__setResult({ error: null });

    await deleteCouponMaster('master-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('coupon_masters');
    expect(mockSupabase.delete).toHaveBeenCalled();
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'master-1');
  });

  // 8. getCouponMasterCount — returns count
  it('getCouponMasterCount() returns the exact count', async () => {
    mockSupabase.__setResult({ count: 42, error: null });

    const result = await getCouponMasterCount();

    expect(mockSupabase.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(result).toBe(42);
  });
});

// ===========================================================================
// Issues tests
// ===========================================================================

describe('coupon issues', () => {
  // 9. issueCoupon — creates issue with generated code
  it('issueCoupon() fetches master code and inserts issue', async () => {
    // First call: fetch master code. Second call: insert issue.
    // Because the mock chain is shared, we switch the result between calls.
    let callCount = 0;
    const issueRow = makeIssueRow();

    // Override `then` to return different results per await
    mockSupabase.then = (resolve: any) => {
      callCount++;
      if (callCount === 1) {
        // master lookup
        return resolve({ data: { code: 'SPRING2026' }, error: null });
      }
      // issue insert
      return resolve({ data: issueRow, error: null });
    };

    const result = await issueCoupon('master-1', 'cust-1', '2026-04-01T00:00:00Z');

    expect(result.couponMasterId).toBe('master-1');
    expect(result.customerId).toBe('cust-1');
    expect(result.status).toBe('issued');

    // insert should have been called with snake_case fields
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        coupon_master_id: 'master-1',
        customer_id: 'cust-1',
        expires_at: '2026-04-01T00:00:00Z',
      }),
    );
    // The issue_code should contain the master code prefix
    const insertArg = mockSupabase.insert.mock.calls[0][0];
    expect(insertArg.issue_code).toMatch(/^SPRING2026-[A-F0-9]{6}$/);
  });

  // 10. batchIssueCoupon — creates multiple issues
  it('batchIssueCoupon() inserts rows for each customer', async () => {
    let callCount = 0;
    const issueRows = [
      makeIssueRow({ id: 'issue-1', customer_id: 'cust-1' }),
      makeIssueRow({ id: 'issue-2', customer_id: 'cust-2' }),
    ];

    mockSupabase.then = (resolve: any) => {
      callCount++;
      if (callCount === 1) {
        return resolve({ data: { code: 'SPRING2026' }, error: null });
      }
      return resolve({ data: issueRows, error: null });
    };

    const result = await batchIssueCoupon(
      'master-1',
      ['cust-1', 'cust-2'],
      '2026-04-01T00:00:00Z',
    );

    expect(result).toHaveLength(2);
    expect(mockSupabase.insert).toHaveBeenCalled();
    const insertArg = mockSupabase.insert.mock.calls[0][0];
    expect(insertArg).toHaveLength(2);
    expect(insertArg[0].coupon_master_id).toBe('master-1');
    expect(insertArg[1].customer_id).toBe('cust-2');
  });

  // 11. getCustomerCoupons — returns customer's coupons with join
  it('getCustomerCoupons() selects with join and maps result', async () => {
    const row = {
      ...makeIssueRow(),
      coupon_masters: {
        name: 'Spring Sale',
        discount_type: 'fixed',
        discount_value: 500,
      },
    };
    mockSupabase.__setResult({ data: [row], error: null });

    const result = await getCustomerCoupons('cust-1');

    expect(mockSupabase.select).toHaveBeenCalledWith(
      '*, coupon_masters(name, discount_type, discount_value)',
    );
    expect(mockSupabase.eq).toHaveBeenCalledWith('customer_id', 'cust-1');
    expect(result).toHaveLength(1);
    expect(result[0].couponName).toBe('Spring Sale');
    expect(result[0].discountType).toBe('fixed');
    expect(result[0].discountValue).toBe(500);
  });

  // 12. getCouponIssues — returns all issues for a master
  it('getCouponIssues() returns all issues for a coupon master', async () => {
    const rows = [
      makeIssueRow({ id: 'issue-1' }),
      makeIssueRow({ id: 'issue-2' }),
    ];
    mockSupabase.__setResult({ data: rows, error: null });

    const result = await getCouponIssues('master-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('coupon_issues');
    expect(mockSupabase.eq).toHaveBeenCalledWith('coupon_master_id', 'master-1');
    expect(result).toHaveLength(2);
  });

  // 13. useCoupon — marks as used and creates usage record
  it('useCoupon() updates status and creates usage record', async () => {
    let callCount = 0;
    const issueRow = makeIssueRow({ status: 'issued' });
    const usageRow = makeUsageRow();

    mockSupabase.then = (resolve: any) => {
      callCount++;
      if (callCount === 1) {
        // fetch issue
        return resolve({ data: issueRow, error: null });
      }
      if (callCount === 2) {
        // update status
        return resolve({ error: null });
      }
      // insert usage
      return resolve({ data: usageRow, error: null });
    };

    const result = await useCoupon('issue-1', 500);

    expect(result.couponIssueId).toBe('issue-1');
    expect(result.discountAmount).toBe(500);

    // Should have updated the issue status
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'used' }),
    );

    // Should have inserted a usage record
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        coupon_issue_id: 'issue-1',
        customer_id: 'cust-1',
        discount_amount: 500,
      }),
    );
  });

  // 14. useCoupon — throws if already used
  it('useCoupon() throws if coupon is already used', async () => {
    const issueRow = makeIssueRow({ status: 'used' });

    mockSupabase.then = (resolve: any) => {
      return resolve({ data: issueRow, error: null });
    };

    await expect(useCoupon('issue-1', 500)).rejects.toThrow(
      'Coupon cannot be used: current status is "used"',
    );
  });

  // 15. revokeCoupon — marks as revoked
  it('revokeCoupon() updates status to revoked', async () => {
    mockSupabase.__setResult({ error: null });

    await revokeCoupon('issue-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('coupon_issues');
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'revoked' }),
    );
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'issue-1');
  });

  // 16. getCouponStats — calculates correct stats
  it('getCouponStats() calculates correct usage stats', async () => {
    const rows = [
      { status: 'issued' },
      { status: 'issued' },
      { status: 'used' },
      { status: 'used' },
      { status: 'used' },
      { status: 'expired' },
      { status: 'revoked' },
      { status: 'revoked' },
    ];
    mockSupabase.__setResult({ data: rows, error: null });

    const stats = await getCouponStats('master-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('coupon_issues');
    expect(mockSupabase.select).toHaveBeenCalledWith('status');
    expect(mockSupabase.eq).toHaveBeenCalledWith('coupon_master_id', 'master-1');

    expect(stats).toEqual({
      totalIssued: 8,
      totalUsed: 3,
      totalRevoked: 2,
      totalExpired: 1,
      usageRate: 3 / 8,
    });
  });
});
