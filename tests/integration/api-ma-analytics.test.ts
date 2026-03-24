// ============================================================================
// tests/integration/api-ma-analytics.test.ts
// Integration tests for MA and Analytics API endpoints
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock service modules
// ---------------------------------------------------------------------------

const mockGetScenarios = vi.fn();
const mockCreateScenario = vi.fn();
const mockGetScenarioById = vi.fn();
const mockUpdateScenario = vi.fn();
const mockDeleteScenario = vi.fn();
const mockGetScenarioLogs = vi.fn();

vi.mock('@/lib/ma/scenarios', () => ({
  getScenarios: (...args: unknown[]) => mockGetScenarios(...args),
  createScenario: (...args: unknown[]) => mockCreateScenario(...args),
  getScenarioById: (...args: unknown[]) => mockGetScenarioById(...args),
  updateScenario: (...args: unknown[]) => mockUpdateScenario(...args),
  deleteScenario: (...args: unknown[]) => mockDeleteScenario(...args),
  getScenarioLogs: (...args: unknown[]) => mockGetScenarioLogs(...args),
}));

const mockGetABTests = vi.fn();
const mockCreateABTest = vi.fn();
const mockGetABTestById = vi.fn();
const mockCalculateTestResults = vi.fn();
const mockAssignCustomersToTest = vi.fn();
const mockGetTestAssignments = vi.fn();

vi.mock('@/lib/ma/ab-tests', () => ({
  getABTests: (...args: unknown[]) => mockGetABTests(...args),
  createABTest: (...args: unknown[]) => mockCreateABTest(...args),
  getABTestById: (...args: unknown[]) => mockGetABTestById(...args),
  updateABTest: vi.fn(),
  deleteABTest: vi.fn(),
  calculateTestResults: (...args: unknown[]) => mockCalculateTestResults(...args),
  assignCustomersToTest: (...args: unknown[]) => mockAssignCustomersToTest(...args),
  getTestAssignments: (...args: unknown[]) => mockGetTestAssignments(...args),
}));

const mockGetDeliveryStats = vi.fn();
const mockGetDailyDeliveryCounts = vi.fn();

vi.mock('@/lib/ma/delivery', () => ({
  getDeliveryStats: (...args: unknown[]) => mockGetDeliveryStats(...args),
  getDailyDeliveryCounts: (...args: unknown[]) => mockGetDailyDeliveryCounts(...args),
}));

const mockGetDashboardKPIs = vi.fn();

vi.mock('@/lib/analytics/kpi', () => ({
  getDashboardKPIs: (...args: unknown[]) => mockGetDashboardKPIs(...args),
}));

const mockGetDeliveryTrend = vi.fn();

vi.mock('@/lib/analytics/charts', () => ({
  getDeliveryTrend: (...args: unknown[]) => mockGetDeliveryTrend(...args),
  getCustomerGrowth: vi.fn(),
  getCouponUsageTrend: vi.fn(),
  getReservationTrend: vi.fn(),
  getTierDistribution: vi.fn(),
  getTopContent: vi.fn(),
  getHourlyActivity: vi.fn(),
  getLifecycleFunnel: vi.fn(),
}));

const mockGenerateReport = vi.fn();
const mockReportToCSV = vi.fn();

vi.mock('@/lib/analytics/reports', () => ({
  generateReport: (...args: unknown[]) => mockGenerateReport(...args),
  reportToCSV: (...args: unknown[]) => mockReportToCSV(...args),
}));

// ---------------------------------------------------------------------------
// Import route handlers AFTER mocking
// ---------------------------------------------------------------------------

import {
  GET as scenariosListGET,
  POST as scenariosListPOST,
} from '@/app/api/ma/scenarios/route';

import {
  GET as scenarioDetailGET,
  PUT as scenarioDetailPUT,
  DELETE as scenarioDetailDELETE,
} from '@/app/api/ma/scenarios/[id]/route';

import { GET as scenarioLogsGET } from '@/app/api/ma/scenarios/[id]/logs/route';

import {
  GET as abTestsListGET,
  POST as abTestsListPOST,
} from '@/app/api/ma/ab-tests/route';

import { GET as abTestDetailGET } from '@/app/api/ma/ab-tests/[id]/route';

import { POST as abTestAssignPOST } from '@/app/api/ma/ab-tests/[id]/assign/route';

import { GET as kpiGET } from '@/app/api/analytics/kpi/route';
import { GET as chartsGET } from '@/app/api/analytics/charts/route';
import { GET as reportsGET } from '@/app/api/analytics/reports/route';
import { GET as deliveryGET } from '@/app/api/analytics/delivery/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

function makeRouteParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// MA API Tests
// ---------------------------------------------------------------------------

describe('MA API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET /api/ma/scenarios
  // -------------------------------------------------------------------------

  describe('GET /api/ma/scenarios', () => {
    it('returns scenarios list', async () => {
      const scenarios = [
        { id: 'sc-1', name: 'Welcome', status: 'active' },
        { id: 'sc-2', name: 'Re-engage', status: 'draft' },
      ];
      mockGetScenarios.mockResolvedValue(scenarios);

      const response = await scenariosListGET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ scenarios });
      expect(mockGetScenarios).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/ma/scenarios
  // -------------------------------------------------------------------------

  describe('POST /api/ma/scenarios', () => {
    it('creates a new scenario', async () => {
      const newScenario = { id: 'sc-3', name: 'Birthday', status: 'draft' };
      mockCreateScenario.mockResolvedValue(newScenario);

      const request = makeRequest('/api/ma/scenarios', {
        method: 'POST',
        body: JSON.stringify({ name: 'Birthday', trigger: 'birthday' }),
      });

      const response = await scenariosListPOST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual({ scenario: newScenario });
      expect(mockCreateScenario).toHaveBeenCalledWith({
        name: 'Birthday',
        trigger: 'birthday',
      });
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/ma/scenarios/[id]
  // -------------------------------------------------------------------------

  describe('GET /api/ma/scenarios/[id]', () => {
    it('returns a scenario by id', async () => {
      const scenario = { id: 'sc-1', name: 'Welcome', status: 'active' };
      mockGetScenarioById.mockResolvedValue(scenario);

      const request = makeRequest('/api/ma/scenarios/sc-1');
      const response = await scenarioDetailGET(request, makeRouteParams('sc-1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ scenario });
      expect(mockGetScenarioById).toHaveBeenCalledWith('sc-1');
    });

    it('returns 404 when scenario not found', async () => {
      mockGetScenarioById.mockResolvedValue(null);

      const request = makeRequest('/api/ma/scenarios/nonexistent');
      const response = await scenarioDetailGET(request, makeRouteParams('nonexistent'));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toHaveProperty('error');
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/ma/scenarios/[id]
  // -------------------------------------------------------------------------

  describe('PUT /api/ma/scenarios/[id]', () => {
    it('updates a scenario', async () => {
      const updated = { id: 'sc-1', name: 'Welcome v2', status: 'active' };
      mockUpdateScenario.mockResolvedValue(updated);

      const request = makeRequest('/api/ma/scenarios/sc-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Welcome v2' }),
      });

      const response = await scenarioDetailPUT(request, makeRouteParams('sc-1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ scenario: updated });
      expect(mockUpdateScenario).toHaveBeenCalledWith('sc-1', { name: 'Welcome v2' });
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/ma/scenarios/[id]
  // -------------------------------------------------------------------------

  describe('DELETE /api/ma/scenarios/[id]', () => {
    it('deletes a scenario', async () => {
      mockDeleteScenario.mockResolvedValue(undefined);

      const request = makeRequest('/api/ma/scenarios/sc-1', { method: 'DELETE' });
      const response = await scenarioDetailDELETE(request, makeRouteParams('sc-1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true });
      expect(mockDeleteScenario).toHaveBeenCalledWith('sc-1');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/ma/scenarios/[id]/logs
  // -------------------------------------------------------------------------

  describe('GET /api/ma/scenarios/[id]/logs', () => {
    it('returns scenario logs', async () => {
      const logs = [
        { id: 'log-1', scenarioId: 'sc-1', action: 'triggered', createdAt: '2025-06-01T00:00:00Z' },
        { id: 'log-2', scenarioId: 'sc-1', action: 'completed', createdAt: '2025-06-01T00:01:00Z' },
      ];
      mockGetScenarioLogs.mockResolvedValue(logs);

      const request = makeRequest('/api/ma/scenarios/sc-1/logs');
      const response = await scenarioLogsGET(request, makeRouteParams('sc-1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ logs });
      expect(mockGetScenarioLogs).toHaveBeenCalledWith('sc-1', undefined);
    });

    it('passes limit query parameter', async () => {
      mockGetScenarioLogs.mockResolvedValue([]);

      const request = makeRequest('/api/ma/scenarios/sc-1/logs?limit=10');
      const response = await scenarioLogsGET(request, makeRouteParams('sc-1'));

      expect(response.status).toBe(200);
      expect(mockGetScenarioLogs).toHaveBeenCalledWith('sc-1', 10);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/ma/ab-tests
  // -------------------------------------------------------------------------

  describe('GET /api/ma/ab-tests', () => {
    it('returns A/B tests list', async () => {
      const tests = [
        { id: 'ab-1', name: 'Subject line test', status: 'running' },
        { id: 'ab-2', name: 'CTA test', status: 'completed' },
      ];
      mockGetABTests.mockResolvedValue(tests);

      const response = await abTestsListGET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ tests });
      expect(mockGetABTests).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/ma/ab-tests
  // -------------------------------------------------------------------------

  describe('POST /api/ma/ab-tests', () => {
    it('creates a new A/B test', async () => {
      const newTest = { id: 'ab-3', name: 'Image test', status: 'draft' };
      mockCreateABTest.mockResolvedValue(newTest);

      const request = makeRequest('/api/ma/ab-tests', {
        method: 'POST',
        body: JSON.stringify({ name: 'Image test', variants: ['A', 'B'] }),
      });

      const response = await abTestsListPOST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual({ test: newTest });
      expect(mockCreateABTest).toHaveBeenCalledWith({
        name: 'Image test',
        variants: ['A', 'B'],
      });
    });

    it('returns 400 when name is missing', async () => {
      const request = makeRequest('/api/ma/ab-tests', {
        method: 'POST',
        body: JSON.stringify({ variants: ['A', 'B'] }),
      });

      const response = await abTestsListPOST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/ma/ab-tests/[id]
  // -------------------------------------------------------------------------

  describe('GET /api/ma/ab-tests/[id]', () => {
    it('returns test with results', async () => {
      const test = { id: 'ab-1', name: 'Subject line test', status: 'running' };
      const results = { variantA: { opens: 120 }, variantB: { opens: 95 } };
      mockGetABTestById.mockResolvedValue(test);
      mockCalculateTestResults.mockResolvedValue(results);

      const request = makeRequest('/api/ma/ab-tests/ab-1');
      const response = await abTestDetailGET(request, makeRouteParams('ab-1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ test, results });
      expect(mockGetABTestById).toHaveBeenCalledWith('ab-1');
      expect(mockCalculateTestResults).toHaveBeenCalledWith('ab-1');
    });

    it('returns 404 when test not found', async () => {
      mockGetABTestById.mockResolvedValue(null);

      const request = makeRequest('/api/ma/ab-tests/nonexistent');
      const response = await abTestDetailGET(request, makeRouteParams('nonexistent'));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toHaveProperty('error');
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/ma/ab-tests/[id]/assign
  // -------------------------------------------------------------------------

  describe('POST /api/ma/ab-tests/[id]/assign', () => {
    it('assigns customers to a test', async () => {
      mockAssignCustomersToTest.mockResolvedValue(undefined);

      const request = makeRequest('/api/ma/ab-tests/ab-1/assign', {
        method: 'POST',
        body: JSON.stringify({ customerIds: ['cust-1', 'cust-2', 'cust-3'] }),
      });

      const response = await abTestAssignPOST(request, makeRouteParams('ab-1'));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual({ success: true });
      expect(mockAssignCustomersToTest).toHaveBeenCalledWith('ab-1', [
        'cust-1',
        'cust-2',
        'cust-3',
      ]);
    });

    it('returns 400 when customerIds is missing', async () => {
      const request = makeRequest('/api/ma/ab-tests/ab-1/assign', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await abTestAssignPOST(request, makeRouteParams('ab-1'));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });

    it('returns 400 when customerIds is empty array', async () => {
      const request = makeRequest('/api/ma/ab-tests/ab-1/assign', {
        method: 'POST',
        body: JSON.stringify({ customerIds: [] }),
      });

      const response = await abTestAssignPOST(request, makeRouteParams('ab-1'));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });
  });
});

// ---------------------------------------------------------------------------
// Analytics API Tests
// ---------------------------------------------------------------------------

describe('Analytics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET /api/analytics/kpi
  // -------------------------------------------------------------------------

  describe('GET /api/analytics/kpi', () => {
    it('returns KPIs with date range', async () => {
      const kpis = {
        totalCustomers: 1500,
        activeCustomers: 800,
        messagesSent: 5000,
        conversionRate: 0.12,
      };
      mockGetDashboardKPIs.mockResolvedValue(kpis);

      const request = makeRequest('/api/analytics/kpi?from=2025-01-01&to=2025-06-30');
      const response = await kpiGET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(kpis);
      expect(mockGetDashboardKPIs).toHaveBeenCalledWith({
        from: '2025-01-01',
        to: '2025-06-30',
      });
    });

    it('returns 400 when from/to params are missing', async () => {
      const request = makeRequest('/api/analytics/kpi');
      const response = await kpiGET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });

    it('returns 400 when only from is provided', async () => {
      const request = makeRequest('/api/analytics/kpi?from=2025-01-01');
      const response = await kpiGET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/analytics/charts
  // -------------------------------------------------------------------------

  describe('GET /api/analytics/charts', () => {
    it('returns chart data by type', async () => {
      const chartData = [
        { date: '2025-01-01', count: 100 },
        { date: '2025-01-02', count: 120 },
      ];
      mockGetDeliveryTrend.mockResolvedValue(chartData);

      const request = makeRequest(
        '/api/analytics/charts?type=delivery&from=2025-01-01&to=2025-01-31'
      );
      const response = await chartsGET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ type: 'delivery', data: chartData });
    });

    it('returns 400 when type param is missing', async () => {
      const request = makeRequest('/api/analytics/charts?from=2025-01-01&to=2025-01-31');
      const response = await chartsGET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });

    it('returns 400 for invalid chart type', async () => {
      const request = makeRequest(
        '/api/analytics/charts?type=invalid&from=2025-01-01&to=2025-01-31'
      );
      const response = await chartsGET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/analytics/reports
  // -------------------------------------------------------------------------

  describe('GET /api/analytics/reports', () => {
    it('returns JSON report by default', async () => {
      const report = {
        type: 'summary',
        dateRange: { from: '2025-01-01', to: '2025-01-31' },
        data: { total: 500, breakdown: [{ label: 'A', value: 300 }] },
      };
      mockGenerateReport.mockResolvedValue(report);

      const request = makeRequest(
        '/api/analytics/reports?type=summary&from=2025-01-01&to=2025-01-31'
      );
      const response = await reportsGET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(report);
      expect(mockGenerateReport).toHaveBeenCalledWith({
        type: 'summary',
        dateRange: { from: '2025-01-01', to: '2025-01-31' },
        format: 'json',
      });
    });

    it('returns CSV with correct headers when format=csv', async () => {
      const report = {
        type: 'summary',
        data: [{ name: 'A', count: 10 }],
      };
      mockGenerateReport.mockResolvedValue(report);
      mockReportToCSV.mockReturnValue('name,count\nA,10');

      const request = makeRequest(
        '/api/analytics/reports?type=summary&from=2025-01-01&to=2025-01-31&format=csv'
      );
      const response = await reportsGET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('.csv');
      expect(text).toBe('name,count\nA,10');
      expect(mockReportToCSV).toHaveBeenCalledWith(report);
    });

    it('returns 400 when required params are missing', async () => {
      const request = makeRequest('/api/analytics/reports');
      const response = await reportsGET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/analytics/delivery
  // -------------------------------------------------------------------------

  describe('GET /api/analytics/delivery', () => {
    it('returns delivery stats with trend', async () => {
      const stats = { sent: 5000, delivered: 4800, opened: 2400, clicked: 600 };
      const trend = [
        { date: '2025-01-01', count: 100 },
        { date: '2025-01-02', count: 150 },
      ];
      mockGetDeliveryStats.mockResolvedValue(stats);
      mockGetDailyDeliveryCounts.mockResolvedValue(trend);

      const request = makeRequest('/api/analytics/delivery?from=2025-01-01&to=2025-01-31');
      const response = await deliveryGET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ stats, trend });
      expect(mockGetDeliveryStats).toHaveBeenCalledWith('2025-01-01', '2025-01-31');
      expect(mockGetDailyDeliveryCounts).toHaveBeenCalledWith('2025-01-01', '2025-01-31');
    });

    it('returns 400 when from/to params are missing', async () => {
      const request = makeRequest('/api/analytics/delivery');
      const response = await deliveryGET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toHaveProperty('error');
    });
  });
});
