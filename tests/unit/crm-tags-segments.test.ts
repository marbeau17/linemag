import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase admin client
// ---------------------------------------------------------------------------

// Accumulated result that the chain builder resolves to.
let mockResult: { data?: unknown; error?: unknown; count?: unknown } = {
  data: [],
  error: null,
};

/** Create a chainable query builder that records calls and returns mockResult. */
function createChainBuilder() {
  const builder: Record<string, unknown> = {};

  const methods = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'order',
    'single',
    'maybeSingle',
  ];

  for (const method of methods) {
    builder[method] = vi.fn().mockImplementation(() => {
      // Terminal methods resolve the accumulated result via thenable
      if (method === 'single' || method === 'maybeSingle') {
        return Promise.resolve(mockResult);
      }
      // Otherwise keep chaining
      return builder;
    });
  }

  // Make the builder itself thenable so `await db.from(...).select(...)...` works.
  builder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
    return Promise.resolve(mockResult).then(resolve, reject);
  };

  return builder;
}

let chainBuilder: ReturnType<typeof createChainBuilder>;

const mockFrom = vi.fn().mockImplementation(() => chainBuilder);

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: mockFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Imports (must come after vi.mock)
// ---------------------------------------------------------------------------

import {
  getCustomerTags,
  addTagToCustomer,
  removeTagFromCustomer,
  bulkAddTags,
  getAllUniqueTags,
  getTagCounts,
} from '@/lib/crm/tags';

import {
  getSegments,
  getSegmentById,
  createSegment,
  updateSegment,
  deleteSegment,
  getSegmentMembers,
  addMembersToSegment,
  removeMemberFromSegment,
  refreshSegmentCount,
} from '@/lib/crm/segments';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  chainBuilder = createChainBuilder();
  mockFrom.mockImplementation(() => chainBuilder);
  mockResult = { data: [], error: null };
});

// ===========================================================================
// Tags
// ===========================================================================

describe('Tags service', () => {
  // 1
  describe('getCustomerTags', () => {
    it('returns tags for a customer', async () => {
      mockResult = {
        data: [
          { id: 't1', customer_id: 'c1', tag: 'vip', created_at: '2025-01-01' },
          { id: 't2', customer_id: 'c1', tag: 'new', created_at: '2025-01-02' },
        ],
        error: null,
      };

      const tags = await getCustomerTags('c1');

      expect(mockFrom).toHaveBeenCalledWith('customer_tags');
      expect(chainBuilder.select).toHaveBeenCalledWith('*');
      expect(chainBuilder.eq).toHaveBeenCalledWith('customer_id', 'c1');
      expect(tags).toEqual([
        { id: 't1', customerId: 'c1', tag: 'vip', createdAt: '2025-01-01' },
        { id: 't2', customerId: 'c1', tag: 'new', createdAt: '2025-01-02' },
      ]);
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'db down' } };
      await expect(getCustomerTags('c1')).rejects.toThrow('getCustomerTags failed: db down');
    });
  });

  // 2
  describe('addTagToCustomer', () => {
    it('upserts a tag', async () => {
      mockResult = { data: null, error: null };
      await addTagToCustomer('c1', 'vip');

      expect(mockFrom).toHaveBeenCalledWith('customer_tags');
      expect(chainBuilder.upsert).toHaveBeenCalledWith(
        { customer_id: 'c1', tag: 'vip' },
        { onConflict: 'customer_id,tag' },
      );
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'upsert fail' } };
      await expect(addTagToCustomer('c1', 'vip')).rejects.toThrow('addTagToCustomer failed');
    });
  });

  // 3
  describe('removeTagFromCustomer', () => {
    it('deletes a tag', async () => {
      mockResult = { data: null, error: null };
      await removeTagFromCustomer('c1', 'vip');

      expect(mockFrom).toHaveBeenCalledWith('customer_tags');
      expect(chainBuilder.delete).toHaveBeenCalled();
      expect(chainBuilder.eq).toHaveBeenCalledWith('customer_id', 'c1');
      expect(chainBuilder.eq).toHaveBeenCalledWith('tag', 'vip');
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'delete fail' } };
      await expect(removeTagFromCustomer('c1', 'vip')).rejects.toThrow(
        'removeTagFromCustomer failed',
      );
    });
  });

  // 4
  describe('bulkAddTags', () => {
    it('upserts multiple tags', async () => {
      mockResult = { data: null, error: null };
      await bulkAddTags('c1', ['vip', 'premium']);

      expect(mockFrom).toHaveBeenCalledWith('customer_tags');
      expect(chainBuilder.upsert).toHaveBeenCalledWith(
        [
          { customer_id: 'c1', tag: 'vip' },
          { customer_id: 'c1', tag: 'premium' },
        ],
        { onConflict: 'customer_id,tag' },
      );
    });

    it('does nothing when tags array is empty', async () => {
      await bulkAddTags('c1', []);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'bulk fail' } };
      await expect(bulkAddTags('c1', ['a'])).rejects.toThrow('bulkAddTags failed');
    });
  });

  // 5
  describe('getAllUniqueTags', () => {
    it('returns deduplicated tag list', async () => {
      mockResult = {
        data: [
          { tag: 'vip' },
          { tag: 'new' },
          { tag: 'vip' },
          { tag: 'premium' },
          { tag: 'new' },
        ],
        error: null,
      };

      const tags = await getAllUniqueTags();

      expect(mockFrom).toHaveBeenCalledWith('customer_tags');
      expect(chainBuilder.select).toHaveBeenCalledWith('tag');
      expect(tags).toEqual(['vip', 'new', 'premium']);
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'select fail' } };
      await expect(getAllUniqueTags()).rejects.toThrow('getAllUniqueTags failed');
    });
  });

  // 6
  describe('getTagCounts', () => {
    it('returns tag counts sorted descending', async () => {
      mockResult = {
        data: [
          { tag: 'vip' },
          { tag: 'vip' },
          { tag: 'vip' },
          { tag: 'new' },
          { tag: 'new' },
          { tag: 'premium' },
        ],
        error: null,
      };

      const counts = await getTagCounts();

      expect(counts).toEqual([
        { tag: 'vip', count: 3 },
        { tag: 'new', count: 2 },
        { tag: 'premium', count: 1 },
      ]);
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'count fail' } };
      await expect(getTagCounts()).rejects.toThrow('getTagCounts failed');
    });
  });
});

// ===========================================================================
// Segments
// ===========================================================================

const sampleSegmentRow = {
  id: 's1',
  name: 'VIP Customers',
  description: 'High-value customers',
  type: 'static' as const,
  rules: [],
  auto_refresh: false,
  last_computed_at: null,
  customer_count: 5,
  created_at: '2025-01-01',
  updated_at: '2025-01-02',
};

const expectedSegment = {
  id: 's1',
  name: 'VIP Customers',
  description: 'High-value customers',
  type: 'static',
  rules: [],
  autoRefresh: false,
  lastComputedAt: null,
  customerCount: 5,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-02',
};

describe('Segments service', () => {
  // 7
  describe('getSegments', () => {
    it('returns all segments', async () => {
      mockResult = { data: [sampleSegmentRow], error: null };

      const segments = await getSegments();

      expect(mockFrom).toHaveBeenCalledWith('segments');
      expect(chainBuilder.select).toHaveBeenCalledWith('*');
      expect(chainBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(segments).toEqual([expectedSegment]);
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'fetch fail' } };
      await expect(getSegments()).rejects.toThrow('Failed to fetch segments');
    });
  });

  // 8
  describe('getSegmentById', () => {
    it('returns segment with mapping', async () => {
      mockResult = { data: sampleSegmentRow, error: null };

      const segment = await getSegmentById('s1');

      expect(mockFrom).toHaveBeenCalledWith('segments');
      expect(chainBuilder.eq).toHaveBeenCalledWith('id', 's1');
      expect(chainBuilder.maybeSingle).toHaveBeenCalled();
      expect(segment).toEqual(expectedSegment);
    });

    it('returns null when not found', async () => {
      mockResult = { data: null, error: null };

      const segment = await getSegmentById('nonexistent');
      expect(segment).toBeNull();
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'not found' } };
      await expect(getSegmentById('s1')).rejects.toThrow('Failed to fetch segment');
    });
  });

  // 9
  describe('createSegment', () => {
    it('creates with correct fields', async () => {
      mockResult = { data: sampleSegmentRow, error: null };

      const segment = await createSegment({
        name: 'VIP Customers',
        description: 'High-value customers',
        type: 'static',
        rules: [],
        autoRefresh: false,
      });

      expect(mockFrom).toHaveBeenCalledWith('segments');
      expect(chainBuilder.insert).toHaveBeenCalledWith({
        name: 'VIP Customers',
        description: 'High-value customers',
        type: 'static',
        rules: [],
        auto_refresh: false,
        customer_count: 0,
      });
      expect(chainBuilder.select).toHaveBeenCalled();
      expect(chainBuilder.single).toHaveBeenCalled();
      expect(segment).toEqual(expectedSegment);
    });

    it('defaults description to null and autoRefresh to false', async () => {
      mockResult = { data: sampleSegmentRow, error: null };

      await createSegment({ name: 'Test', type: 'dynamic' });

      expect(chainBuilder.insert).toHaveBeenCalledWith({
        name: 'Test',
        description: null,
        type: 'dynamic',
        rules: [],
        auto_refresh: false,
        customer_count: 0,
      });
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'insert fail' } };
      await expect(createSegment({ name: 'X', type: 'static' })).rejects.toThrow(
        'Failed to create segment',
      );
    });
  });

  // 10
  describe('updateSegment', () => {
    it('updates fields', async () => {
      mockResult = { data: { ...sampleSegmentRow, name: 'Updated' }, error: null };

      const segment = await updateSegment('s1', { name: 'Updated' });

      expect(mockFrom).toHaveBeenCalledWith('segments');
      expect(chainBuilder.update).toHaveBeenCalledWith({ name: 'Updated' });
      expect(chainBuilder.eq).toHaveBeenCalledWith('id', 's1');
      expect(chainBuilder.single).toHaveBeenCalled();
      expect(segment.name).toBe('Updated');
    });

    it('maps autoRefresh to auto_refresh', async () => {
      mockResult = { data: sampleSegmentRow, error: null };

      await updateSegment('s1', { autoRefresh: true });

      expect(chainBuilder.update).toHaveBeenCalledWith({ auto_refresh: true });
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'update fail' } };
      await expect(updateSegment('s1', { name: 'X' })).rejects.toThrow(
        'Failed to update segment',
      );
    });
  });

  // 11
  describe('deleteSegment', () => {
    it('deletes segment and members', async () => {
      mockResult = { data: null, error: null };

      await deleteSegment('s1');

      // First call deletes members, second deletes segment
      expect(mockFrom).toHaveBeenCalledWith('segment_members');
      expect(mockFrom).toHaveBeenCalledWith('segments');
      expect(chainBuilder.delete).toHaveBeenCalled();
      expect(chainBuilder.eq).toHaveBeenCalledWith('segment_id', 's1');
      expect(chainBuilder.eq).toHaveBeenCalledWith('id', 's1');
    });

    it('throws when member deletion fails', async () => {
      mockResult = { data: null, error: { message: 'member delete fail' } };
      await expect(deleteSegment('s1')).rejects.toThrow('Failed to delete segment members');
    });

    it('throws when segment deletion fails', async () => {
      // First call (members) succeeds, second call (segment) fails
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          // member delete chain — succeeds
          const successChain = createChainBuilder();
          // Override the thenable to resolve success
          successChain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject);
          return successChain;
        }
        // segment delete chain — fails
        const failChain = createChainBuilder();
        failChain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
          Promise.resolve({ data: null, error: { message: 'segment delete fail' } }).then(
            resolve,
            reject,
          );
        return failChain;
      });

      await expect(deleteSegment('s1')).rejects.toThrow('Failed to delete segment');
    });
  });

  // 12
  describe('getSegmentMembers', () => {
    it('returns customer IDs', async () => {
      mockResult = {
        data: [{ customer_id: 'c1' }, { customer_id: 'c2' }, { customer_id: 'c3' }],
        error: null,
      };

      const members = await getSegmentMembers('s1');

      expect(mockFrom).toHaveBeenCalledWith('segment_members');
      expect(chainBuilder.select).toHaveBeenCalledWith('customer_id');
      expect(chainBuilder.eq).toHaveBeenCalledWith('segment_id', 's1');
      expect(members).toEqual(['c1', 'c2', 'c3']);
    });

    it('throws on error', async () => {
      mockResult = { data: null, error: { message: 'members fail' } };
      await expect(getSegmentMembers('s1')).rejects.toThrow('Failed to fetch segment members');
    });
  });

  // 13
  describe('addMembersToSegment', () => {
    it('upserts members and refreshes count', async () => {
      // The function calls: upsert members, then refreshSegmentCount
      // refreshSegmentCount calls: select count, then update segments
      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex++;
        const chain = createChainBuilder();
        if (callIndex === 1) {
          // upsert members — succeeds
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject);
        } else if (callIndex === 2) {
          // count query
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ count: 3, error: null }).then(resolve, reject);
        } else {
          // update segment count
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        return chain;
      });

      await addMembersToSegment('s1', ['c1', 'c2']);

      // Check upsert was called for segment_members
      expect(mockFrom).toHaveBeenCalledWith('segment_members');
      // Check that segments table was updated for count
      expect(mockFrom).toHaveBeenCalledWith('segments');
    });

    it('does nothing when customerIds is empty', async () => {
      await addMembersToSegment('s1', []);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('throws on upsert error', async () => {
      mockResult = { data: null, error: { message: 'upsert fail' } };
      await expect(addMembersToSegment('s1', ['c1'])).rejects.toThrow(
        'Failed to add members to segment',
      );
    });
  });

  // 14
  describe('removeMemberFromSegment', () => {
    it('removes member and refreshes count', async () => {
      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex++;
        const chain = createChainBuilder();
        if (callIndex === 1) {
          // delete member
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject);
        } else if (callIndex === 2) {
          // count query
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ count: 2, error: null }).then(resolve, reject);
        } else {
          // update segment count
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        return chain;
      });

      await removeMemberFromSegment('s1', 'c1');

      expect(mockFrom).toHaveBeenCalledWith('segment_members');
      expect(mockFrom).toHaveBeenCalledWith('segments');
    });

    it('throws on delete error', async () => {
      mockResult = { data: null, error: { message: 'delete fail' } };
      await expect(removeMemberFromSegment('s1', 'c1')).rejects.toThrow(
        'Failed to remove member from segment',
      );
    });
  });

  // 15
  describe('refreshSegmentCount', () => {
    it('updates customer_count', async () => {
      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex++;
        const chain = createChainBuilder();
        if (callIndex === 1) {
          // count query on segment_members
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ count: 7, error: null }).then(resolve, reject);
        } else {
          // update segments
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        return chain;
      });

      const count = await refreshSegmentCount('s1');

      expect(count).toBe(7);
      expect(mockFrom).toHaveBeenCalledWith('segment_members');
      expect(mockFrom).toHaveBeenCalledWith('segments');
    });

    it('throws on count error', async () => {
      mockResult = { count: null, error: { message: 'count fail' } };
      await expect(refreshSegmentCount('s1')).rejects.toThrow('Failed to count segment members');
    });

    it('throws on update error', async () => {
      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex++;
        const chain = createChainBuilder();
        if (callIndex === 1) {
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ count: 5, error: null }).then(resolve, reject);
        } else {
          chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ data: null, error: { message: 'update fail' } }).then(
              resolve,
              reject,
            );
        }
        return chain;
      });

      await expect(refreshSegmentCount('s1')).rejects.toThrow('Failed to update segment count');
    });
  });
});
