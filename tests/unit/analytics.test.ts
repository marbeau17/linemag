// ============================================================================
// tests/unit/analytics.test.ts
// Unit tests for analytics services: kpi, charts, reports
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/admin
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockEq = vi.fn();
const mockNot = vi.fn();
const mockIs = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

function createChain(resolvedValue: any = { data: [], error: null, count: 0 }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };

  // Make the chain thenable so await resolves to resolvedValue
  chain.then = (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject);

  return chain;
}

let mockChainFactory: (table: string) => any;

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => mockChainFactory(table)),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (must come after vi.mock)
// ---------------------------------------------------------------------------

import { getPreviousPeriod, getDashboardKPIs } from '@/lib/analytics/kpi';
import type { DateRange } from '@/lib/analytics/kpi';
import {
  getDeliveryTrend,
  getCustomerGrowth,
  getCouponUsageTrend,
  getReservationTrend,
  getTierDistribution,
  getLifecycleFunnel,
} from '@/lib/analytics/charts';
import { generateReport, reportToCSV } from '@/lib/analytics/reports';
import type { ReportResult } from '@/lib/analytics/reports';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chain where every query method returns the given resolved value. */
function chainResolving(value: any) {
  const chain: any = {};
  const methods = ['select', 'from', 'gte', 'lte', 'eq', 'not', 'is', 'in', 'order', 'limit'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject);
  return chain;
}

const RANGE: DateRange = { from: '2025-01-01', to: '2025-01-31' };

// ============================================================================
// KPI Tests
// ============================================================================

describe('KPI Service', () => {
  // -------------------------------------------------------------------------
  // 1. getPreviousPeriod
  // -------------------------------------------------------------------------
  describe('getPreviousPeriod()', () => {
    it('calculates correct previous period for a 31-day range', () => {
      const result = getPreviousPeriod({ from: '2025-01-01', to: '2025-01-31' });

      // The current range is Jan 1 - Jan 31 (30 days of diff).
      // Previous period ends 1ms before Jan 1 = Dec 31, and starts 30 days before that.
      expect(result.to).toBe('2024-12-31');
      expect(result.from).toBe('2024-12-01');
    });

    it('calculates correct previous period for a 7-day range', () => {
      const result = getPreviousPeriod({ from: '2025-03-10', to: '2025-03-16' });
      // diff = 6 days; prevTo = Mar 9, prevFrom = Mar 3
      expect(result.to).toBe('2025-03-09');
      expect(result.from).toBe('2025-03-03');
    });

    it('handles single-day range', () => {
      const result = getPreviousPeriod({ from: '2025-06-15', to: '2025-06-15' });
      // diff = 0; prevTo = Jun 14, prevFrom = Jun 14
      expect(result.to).toBe('2025-06-14');
      expect(result.from).toBe('2025-06-14');
    });
  });

  // -------------------------------------------------------------------------
  // 2. getDashboardKPIs — returns all KPI cards with trends
  // -------------------------------------------------------------------------
  describe('getDashboardKPIs()', () => {
    beforeEach(() => {
      // Default: all queries return count: 0 / empty data
      mockChainFactory = () => chainResolving({ data: [], error: null, count: 0 });
    });

    it('returns all KPI cards with trends', async () => {
      const result = await getDashboardKPIs(RANGE);

      // Should contain all 12 KPI card keys
      const expectedKeys = [
        'totalDeliveries',
        'openRate',
        'clickRate',
        'totalCustomers',
        'newCustomers',
        'activeCustomers',
        'churnRate',
        'couponIssued',
        'couponUsageRate',
        'totalReservations',
        'reservationRate',
        'cancelRate',
      ];

      for (const key of expectedKeys) {
        expect(result).toHaveProperty(key);
        const card = (result as any)[key];
        expect(card).toHaveProperty('label');
        expect(card).toHaveProperty('value');
        expect(card).toHaveProperty('change');
        expect(card).toHaveProperty('trend');
        expect(card).toHaveProperty('format');
        expect(['up', 'down', 'flat']).toContain(card.trend);
        expect(['number', 'percentage', 'currency', 'string']).toContain(card.format);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 3. KPI change calculation — up/down/flat trends
  // -------------------------------------------------------------------------
  describe('KPI change calculation (up/down/flat)', () => {
    it('reports "up" trend when current > previous by >= 1%', async () => {
      let callCount = 0;
      mockChainFactory = () => {
        // Alternate between current (200) and previous (100) for delivery counts
        callCount++;
        const count = callCount % 2 === 1 ? 200 : 100;
        return chainResolving({ data: [], error: null, count });
      };

      const result = await getDashboardKPIs(RANGE);
      // totalDeliveries: current=200, prev=100 => +100% => 'up'
      expect(result.totalDeliveries.trend).toBe('up');
      expect(result.totalDeliveries.change).toBe(100);
    });

    it('reports "down" trend when current < previous by >= 1%', async () => {
      let callCount = 0;
      mockChainFactory = () => {
        callCount++;
        const count = callCount % 2 === 1 ? 50 : 100;
        return chainResolving({ data: [], error: null, count });
      };

      const result = await getDashboardKPIs(RANGE);
      // totalDeliveries: current=50, prev=100 => -50% => 'down'
      expect(result.totalDeliveries.trend).toBe('down');
      expect(result.totalDeliveries.change).toBe(-50);
    });

    it('reports "flat" trend when change is less than 1%', async () => {
      mockChainFactory = () => chainResolving({ data: [], error: null, count: 100 });

      const result = await getDashboardKPIs(RANGE);
      // current=100, prev=100 => 0% => 'flat'
      expect(result.totalDeliveries.trend).toBe('flat');
      expect(result.totalDeliveries.change).toBe(0);
    });
  });
});

// ============================================================================
// Charts Tests
// ============================================================================

describe('Charts Service', () => {
  // -------------------------------------------------------------------------
  // 4. getDeliveryTrend
  // -------------------------------------------------------------------------
  describe('getDeliveryTrend()', () => {
    it('returns daily delivery data with sent/opened/clicked', async () => {
      const threeDayRange: DateRange = { from: '2025-01-01', to: '2025-01-03' };

      mockChainFactory = () =>
        chainResolving({
          data: [
            { sent_at: '2025-01-01T10:00:00', status: 'sent' },
            { sent_at: '2025-01-01T11:00:00', status: 'opened' },
            { sent_at: '2025-01-02T09:00:00', status: 'clicked' },
            { sent_at: '2025-01-03T08:00:00', status: 'sent' },
          ],
          error: null,
        });

      const result = await getDeliveryTrend(threeDayRange);

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe('2025-01-01');
      expect(result[0].sent).toBe(2);
      expect(result[0].opened).toBe(1); // 'opened' status
      expect(result[0].clicked).toBe(0);

      expect(result[1].date).toBe('2025-01-02');
      expect(result[1].sent).toBe(1);
      expect(result[1].opened).toBe(1); // 'clicked' also counts as opened
      expect(result[1].clicked).toBe(1);

      expect(result[2].date).toBe('2025-01-03');
      expect(result[2].sent).toBe(1);
      expect(result[2].opened).toBe(0);
      expect(result[2].clicked).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. getCustomerGrowth
  // -------------------------------------------------------------------------
  describe('getCustomerGrowth()', () => {
    it('returns growth data with running total', async () => {
      const twoDayRange: DateRange = { from: '2025-01-02', to: '2025-01-03' };

      mockChainFactory = () =>
        chainResolving({
          data: [
            { first_seen_at: '2025-01-01T00:00:00', blocked_at: null }, // before range
            { first_seen_at: '2025-01-02T10:00:00', blocked_at: null },
            { first_seen_at: '2025-01-03T10:00:00', blocked_at: '2025-01-03T15:00:00' },
          ],
          error: null,
        });

      const result = await getCustomerGrowth(twoDayRange);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2025-01-02');
      // running total: 1 (pre-existing) + 1 new - 0 churned = 2
      expect(result[0].total).toBe(2);
      expect(result[0].new).toBe(1);
      expect(result[0].churned).toBe(0);

      expect(result[1].date).toBe('2025-01-03');
      // running total: 2 + 1 new - 1 churned = 2
      expect(result[1].total).toBe(2);
      expect(result[1].new).toBe(1);
      expect(result[1].churned).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 6. getCouponUsageTrend
  // -------------------------------------------------------------------------
  describe('getCouponUsageTrend()', () => {
    it('returns issued/used data per day', async () => {
      const twoDayRange: DateRange = { from: '2025-01-01', to: '2025-01-02' };

      let callIndex = 0;
      mockChainFactory = () => {
        callIndex++;
        // First call: coupon_issues (issued_at)
        if (callIndex === 1) {
          return chainResolving({
            data: [
              { issued_at: '2025-01-01T10:00:00' },
              { issued_at: '2025-01-01T11:00:00' },
              { issued_at: '2025-01-02T09:00:00' },
            ],
            error: null,
          });
        }
        // Second call: coupon_issues (used_at)
        return chainResolving({
          data: [{ used_at: '2025-01-01T12:00:00' }],
          error: null,
        });
      };

      const result = await getCouponUsageTrend(twoDayRange);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2025-01-01');
      expect(result[0].issued).toBe(2);
      expect(result[0].used).toBe(1);

      expect(result[1].date).toBe('2025-01-02');
      expect(result[1].issued).toBe(1);
      expect(result[1].used).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7. getReservationTrend
  // -------------------------------------------------------------------------
  describe('getReservationTrend()', () => {
    it('returns reservation data with total/completed/cancelled', async () => {
      const twoDayRange: DateRange = { from: '2025-01-01', to: '2025-01-02' };

      mockChainFactory = () =>
        chainResolving({
          data: [
            { created_at: '2025-01-01T10:00:00', status: 'completed' },
            { created_at: '2025-01-01T11:00:00', status: 'cancelled' },
            { created_at: '2025-01-02T09:00:00', status: 'completed' },
            { created_at: '2025-01-02T10:00:00', status: 'pending' },
          ],
          error: null,
        });

      const result = await getReservationTrend(twoDayRange);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2025-01-01');
      expect(result[0].total).toBe(2);
      expect(result[0].completed).toBe(1);
      expect(result[0].cancelled).toBe(1);

      expect(result[1].date).toBe('2025-01-02');
      expect(result[1].total).toBe(2);
      expect(result[1].completed).toBe(1);
      expect(result[1].cancelled).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 8. getTierDistribution
  // -------------------------------------------------------------------------
  describe('getTierDistribution()', () => {
    it('returns tier counts in order [free, silver, gold, platinum]', async () => {
      mockChainFactory = () =>
        chainResolving({
          data: [
            { membership_tier: 'gold' },
            { membership_tier: 'gold' },
            { membership_tier: 'silver' },
            { membership_tier: null }, // defaults to 'free'
            { membership_tier: 'platinum' },
          ],
          error: null,
        });

      const result = await getTierDistribution();

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ tier: 'free', count: 1 });
      expect(result[1]).toEqual({ tier: 'silver', count: 1 });
      expect(result[2]).toEqual({ tier: 'gold', count: 2 });
      expect(result[3]).toEqual({ tier: 'platinum', count: 1 });
    });
  });

  // -------------------------------------------------------------------------
  // 9. getLifecycleFunnel
  // -------------------------------------------------------------------------
  describe('getLifecycleFunnel()', () => {
    it('returns funnel stages based on message_count and recency', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago
      const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago

      mockChainFactory = () =>
        chainResolving({
          data: [
            { message_count: 0, last_seen_at: recentDate },   // new (<=1)
            { message_count: 1, last_seen_at: recentDate },   // new (<=1)
            { message_count: 5, last_seen_at: recentDate },   // active (2-9 recent)
            { message_count: 3, last_seen_at: oldDate },      // new (2-9 but NOT recent)
            { message_count: 20, last_seen_at: recentDate },  // settled (10-49 recent)
            { message_count: 15, last_seen_at: oldDate },     // new (10-49 but NOT recent)
            { message_count: 50, last_seen_at: recentDate },  // loyal (>=50)
            { message_count: 100, last_seen_at: oldDate },    // loyal (>=50, regardless of recency)
          ],
          error: null,
        });

      const result = await getLifecycleFunnel();

      expect(result).toHaveLength(4);
      // new: msg<=1 (2) + not-recent 2-9 (1) + not-recent 10-49 (1) = 4
      expect(result[0]).toEqual({ stage: '新規', count: 4 });
      // active: msg 2-9 AND recent = 1
      expect(result[1]).toEqual({ stage: 'アクティブ', count: 1 });
      // settled: msg 10-49 AND recent = 1
      expect(result[2]).toEqual({ stage: '定着', count: 1 });
      // loyal: msg >= 50 = 2
      expect(result[3]).toEqual({ stage: 'ロイヤル', count: 2 });
    });
  });
});

// ============================================================================
// Reports Tests
// ============================================================================

describe('Reports Service', () => {
  // -------------------------------------------------------------------------
  // 10. generateReport — dispatches to correct generator
  // -------------------------------------------------------------------------
  describe('generateReport()', () => {
    beforeEach(() => {
      mockChainFactory = () => chainResolving({ data: [], error: null, count: 0 });
    });

    it('dispatches to delivery report generator', async () => {
      const result = await generateReport({
        type: 'delivery',
        dateRange: RANGE,
        format: 'json',
      });
      expect(result.title).toBe('配信レポート');
    });

    it('dispatches to customers report generator', async () => {
      const result = await generateReport({
        type: 'customers',
        dateRange: RANGE,
        format: 'json',
      });
      expect(result.title).toBe('顧客レポート');
    });

    it('dispatches to coupons report generator', async () => {
      const result = await generateReport({
        type: 'coupons',
        dateRange: RANGE,
        format: 'json',
      });
      expect(result.title).toBe('クーポンレポート');
    });

    it('dispatches to bookings report generator', async () => {
      const result = await generateReport({
        type: 'bookings',
        dateRange: RANGE,
        format: 'json',
      });
      expect(result.title).toBe('予約レポート');
    });

    it('dispatches to summary report generator', async () => {
      const result = await generateReport({
        type: 'summary',
        dateRange: RANGE,
        format: 'json',
      });
      expect(result.title).toBe('サマリーレポート');
    });

    it('throws on unknown report type', async () => {
      await expect(
        generateReport({
          type: 'unknown' as any,
          dateRange: RANGE,
          format: 'json',
        }),
      ).rejects.toThrow('Unknown report type: unknown');
    });
  });

  // -------------------------------------------------------------------------
  // 11. reportToCSV — generates valid CSV with BOM
  // -------------------------------------------------------------------------
  describe('reportToCSV()', () => {
    const sampleReport: ReportResult = {
      title: 'Test Report',
      generatedAt: '2025-01-01T00:00:00Z',
      dateRange: RANGE,
      summary: {},
      rows: [
        { name: 'Alice', score: 100 },
        { name: 'Bob', score: 200 },
      ],
      columns: [
        { key: 'name', label: '名前', type: 'string' },
        { key: 'score', label: 'スコア', type: 'number' },
      ],
    };

    it('generates valid CSV with BOM prefix', () => {
      const csv = reportToCSV(sampleReport);

      // Starts with UTF-8 BOM
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      const lines = csv.slice(1).split('\r\n');
      // Header + 2 data rows + trailing empty after final \r\n
      expect(lines[0]).toBe('名前,スコア');
      expect(lines[1]).toBe('Alice,100');
      expect(lines[2]).toBe('Bob,200');
    });

    // -----------------------------------------------------------------------
    // 12. reportToCSV — escapes commas and quotes in values
    // -----------------------------------------------------------------------
    it('escapes commas and quotes in values', () => {
      const reportWithSpecialChars: ReportResult = {
        title: 'Test',
        generatedAt: '2025-01-01T00:00:00Z',
        dateRange: RANGE,
        summary: {},
        rows: [
          { name: 'Hello, World', desc: 'She said "hi"' },
          { name: 'Normal', desc: 'Line\nbreak' },
        ],
        columns: [
          { key: 'name', label: '名前', type: 'string' },
          { key: 'desc', label: '説明', type: 'string' },
        ],
      };

      const csv = reportToCSV(reportWithSpecialChars);
      const lines = csv.slice(1).split('\r\n');

      // Comma in value => wrapped in quotes
      expect(lines[1]).toBe('"Hello, World","She said ""hi"""');
      // Newline in value => wrapped in quotes
      expect(lines[2]).toContain('"Line\nbreak"');
    });
  });

  // -------------------------------------------------------------------------
  // 13. Delivery report — contains correct columns
  // -------------------------------------------------------------------------
  describe('Delivery report', () => {
    it('contains correct columns', async () => {
      mockChainFactory = () => chainResolving({ data: [], error: null, count: 0 });

      const result = await generateReport({
        type: 'delivery',
        dateRange: RANGE,
        format: 'json',
      });

      const columnKeys = result.columns.map((c) => c.key);
      expect(columnKeys).toEqual(['date', 'title', 'template', 'status', 'sent_count']);

      const columnLabels = result.columns.map((c) => c.label);
      expect(columnLabels).toEqual(['配信日', 'タイトル', 'テンプレート', 'ステータス', '送信数']);
    });
  });

  // -------------------------------------------------------------------------
  // 14. Customer report — contains correct columns
  // -------------------------------------------------------------------------
  describe('Customer report', () => {
    it('contains correct columns', async () => {
      mockChainFactory = () => chainResolving({ data: [], error: null, count: 0 });

      const result = await generateReport({
        type: 'customers',
        dateRange: RANGE,
        format: 'json',
      });

      const columnKeys = result.columns.map((c) => c.key);
      expect(columnKeys).toEqual([
        'display_name',
        'line_user_id',
        'tier',
        'message_count',
        'first_seen',
        'last_seen',
      ]);

      const columnLabels = result.columns.map((c) => c.label);
      expect(columnLabels).toEqual(['表示名', 'LINE ID', '会員ランク', 'メッセージ数', '初回', '最終']);
    });
  });

  // -------------------------------------------------------------------------
  // 15. Summary report — aggregates all metrics
  // -------------------------------------------------------------------------
  describe('Summary report', () => {
    it('aggregates all metrics', async () => {
      mockChainFactory = (table: string) => {
        // Return different counts for different tables
        const counts: Record<string, number> = {
          broadcasts: 5,
          delivery_logs: 500,
          customers: 50,
          coupon_issues: 100,
          reservations: 30,
        };
        return chainResolving({
          data: [],
          error: null,
          count: counts[table] ?? 0,
        });
      };

      const result = await generateReport({
        type: 'summary',
        dateRange: RANGE,
        format: 'json',
      });

      expect(result.title).toBe('サマリーレポート');

      // Summary should contain all expected keys
      expect(result.summary).toHaveProperty('total_broadcasts');
      expect(result.summary).toHaveProperty('total_deliveries');
      expect(result.summary).toHaveProperty('new_customers');
      expect(result.summary).toHaveProperty('coupons_issued');
      expect(result.summary).toHaveProperty('coupons_used');
      expect(result.summary).toHaveProperty('coupon_usage_rate');
      expect(result.summary).toHaveProperty('total_bookings');
      expect(result.summary).toHaveProperty('completed_bookings');
      expect(result.summary).toHaveProperty('booking_completion_rate');

      // Rows should contain 9 metric entries
      expect(result.rows).toHaveLength(9);

      // Columns should be metric/value/unit
      const columnKeys = result.columns.map((c) => c.key);
      expect(columnKeys).toEqual(['metric', 'value', 'unit']);

      // Check that row metrics include all expected items
      const metricNames = result.rows.map((r) => r.metric);
      expect(metricNames).toContain('配信回数');
      expect(metricNames).toContain('総送信数');
      expect(metricNames).toContain('新規顧客数');
      expect(metricNames).toContain('クーポン発行数');
      expect(metricNames).toContain('クーポン使用数');
      expect(metricNames).toContain('クーポン使用率');
      expect(metricNames).toContain('予約件数');
      expect(metricNames).toContain('予約完了件数');
      expect(metricNames).toContain('予約完了率');
    });
  });
});
