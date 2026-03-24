// ============================================================================
// tests/integration/api-webhook-cron.test.ts
// Integration tests for webhook and cron API endpoints
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockUpsertCustomerByLineUserId = vi.fn();
const mockGetCustomers = vi.fn();
const mockGetCustomerById = vi.fn();
const mockTrackAction = vi.fn();

vi.mock('@/lib/crm/customers', () => ({
  upsertCustomerByLineUserId: (...args: unknown[]) => mockUpsertCustomerByLineUserId(...args),
  getCustomers: (...args: unknown[]) => mockGetCustomers(...args),
  getCustomerById: (...args: unknown[]) => mockGetCustomerById(...args),
}));

vi.mock('@/lib/crm/actions', () => ({
  trackAction: (...args: unknown[]) => mockTrackAction(...args),
}));

const mockStorageGetSchedule = vi.fn();
const mockStorageGetSentUrls = vi.fn();
const mockStorageAddSentUrl = vi.fn();
const mockStorageResetConsecutiveErrors = vi.fn();
const mockStorageIncrementConsecutiveErrors = vi.fn();

vi.mock('@/lib/line/storage-factory', () => ({
  storage: {
    getSchedule: (...args: unknown[]) => mockStorageGetSchedule(...args),
    getSentUrls: (...args: unknown[]) => mockStorageGetSentUrls(...args),
    addSentUrl: (...args: unknown[]) => mockStorageAddSentUrl(...args),
    resetConsecutiveErrors: (...args: unknown[]) => mockStorageResetConsecutiveErrors(...args),
    incrementConsecutiveErrors: (...args: unknown[]) => mockStorageIncrementConsecutiveErrors(...args),
  },
}));

const mockScrapeLatestArticles = vi.fn();
vi.mock('@/lib/line/scraper', () => ({
  scrapeLatestArticles: (...args: unknown[]) => mockScrapeLatestArticles(...args),
}));

const mockSummarizeArticle = vi.fn();
vi.mock('@/lib/line/summarizer', () => ({
  summarizeArticle: (...args: unknown[]) => mockSummarizeArticle(...args),
}));

const mockBroadcastArticle = vi.fn();
vi.mock('@/lib/line/messaging', () => ({
  broadcastArticle: (...args: unknown[]) => mockBroadcastArticle(...args),
  LineApiError: class LineApiError extends Error {
    isAuthError: boolean;
    constructor(message: string, isAuthError = false) {
      super(message);
      this.isAuthError = isAuthError;
    }
  },
}));

const mockLogExecution = vi.fn();
vi.mock('@/lib/line/logger', () => ({
  logExecution: (...args: unknown[]) => mockLogExecution(...args),
}));

const mockNotifyOnError = vi.fn();
vi.mock('@/lib/line/notifier', () => ({
  notifyOnError: (...args: unknown[]) => mockNotifyOnError(...args),
}));

const mockGetUpcomingReservationsForReminder = vi.fn();
const mockMarkReminderSent = vi.fn();
vi.mock('@/lib/booking/reservations', () => ({
  getUpcomingReservationsForReminder: (...args: unknown[]) =>
    mockGetUpcomingReservationsForReminder(...args),
  markReminderSent: (...args: unknown[]) => mockMarkReminderSent(...args),
}));

const mockGetScenarios = vi.fn();
const mockLogScenarioExecution = vi.fn();
const mockUpdateScenarioStats = vi.fn();
vi.mock('@/lib/ma/scenarios', () => ({
  getScenarios: (...args: unknown[]) => mockGetScenarios(...args),
  logScenarioExecution: (...args: unknown[]) => mockLogScenarioExecution(...args),
  updateScenarioStats: (...args: unknown[]) => mockUpdateScenarioStats(...args),
}));

// Mock supabase admin (used by ma-executor directly)
const mockSupabaseFrom = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

// Mock LINE config (used by reservation-reminder)
vi.mock('@/lib/line/config', () => ({
  config: {
    line: {
      channelAccessToken: 'test-token',
      pushUrl: 'https://api.line.me/v2/bot/message/push',
    },
  },
}));

// Mock templates-business (used by reservation-reminder)
vi.mock('@/lib/line/templates-business', () => ({
  buildReservationReminderMessage: vi.fn(() => ({ type: 'bubble', body: {} })),
}));

// Mock global fetch for reservation-reminder push API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Import route handlers AFTER mocks are set up
// ---------------------------------------------------------------------------

import { POST as webhookPOST, GET as webhookGET } from '@/app/api/line/webhook/route';
import { GET as lineBroadcastGET } from '@/app/api/cron/line-broadcast/route';
import { GET as reservationReminderGET } from '@/app/api/cron/reservation-reminder/route';
import { GET as maExecutorGET } from '@/app/api/cron/ma-executor/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWebhookRequest(events: unknown[]) {
  return new NextRequest('http://localhost:3000/api/line/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
}

function createCronRequest(path: string, withAuth = true) {
  const headers: Record<string, string> = {};
  if (withAuth) {
    headers['authorization'] = 'Bearer test-cron-secret';
  }
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/line/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes follow event', async () => {
    const mockCustomer = { id: 'cust-001', lineUserId: 'U001', messageCount: 0 };
    mockUpsertCustomerByLineUserId.mockResolvedValue(mockCustomer);
    mockTrackAction.mockResolvedValue(undefined);

    const request = createWebhookRequest([
      {
        type: 'follow',
        source: { type: 'user', userId: 'U001' },
        timestamp: Date.now(),
      },
    ]);

    const response = await webhookPOST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(mockUpsertCustomerByLineUserId).toHaveBeenCalledWith(
      'U001',
      expect.objectContaining({
        firstSeenAt: expect.any(String),
        lastSeenAt: expect.any(String),
        blockedAt: null,
      }),
    );
    expect(mockTrackAction).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-001',
        actionType: 'follow',
        source: 'line_webhook',
      }),
    );
  });

  it('processes unfollow event', async () => {
    const mockCustomer = { id: 'cust-002', lineUserId: 'U002', messageCount: 0 };
    mockUpsertCustomerByLineUserId.mockResolvedValue(mockCustomer);
    mockTrackAction.mockResolvedValue(undefined);

    const request = createWebhookRequest([
      {
        type: 'unfollow',
        source: { type: 'user', userId: 'U002' },
        timestamp: Date.now(),
      },
    ]);

    const response = await webhookPOST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(mockUpsertCustomerByLineUserId).toHaveBeenCalledWith(
      'U002',
      expect.objectContaining({
        blockedAt: expect.any(String),
        lastSeenAt: expect.any(String),
      }),
    );
    expect(mockTrackAction).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-002',
        actionType: 'unfollow',
        source: 'line_webhook',
      }),
    );
  });

  it('processes message event', async () => {
    const mockCustomer = { id: 'cust-003', lineUserId: 'U003', messageCount: 5 };
    mockUpsertCustomerByLineUserId.mockResolvedValue(mockCustomer);
    mockTrackAction.mockResolvedValue(undefined);

    const request = createWebhookRequest([
      {
        type: 'message',
        source: { type: 'user', userId: 'U003' },
        message: { type: 'text', text: 'Hello!' },
        timestamp: Date.now(),
        replyToken: 'reply-token-123',
      },
    ]);

    const response = await webhookPOST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');

    // First call: fetch existing customer
    expect(mockUpsertCustomerByLineUserId).toHaveBeenCalledWith(
      'U003',
      expect.objectContaining({ lastSeenAt: expect.any(String) }),
    );
    // Second call: increment message count
    expect(mockUpsertCustomerByLineUserId).toHaveBeenCalledWith(
      'U003',
      expect.objectContaining({
        messageCount: 6,
        lastSeenAt: expect.any(String),
      }),
    );
    expect(mockTrackAction).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-003',
        actionType: 'message_received',
        actionDetail: { messageType: 'text', text: 'Hello!' },
        source: 'line_webhook',
      }),
    );
  });

  it('handles empty events (verification)', async () => {
    const request = createWebhookRequest([]);

    const response = await webhookPOST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(mockUpsertCustomerByLineUserId).not.toHaveBeenCalled();
    expect(mockTrackAction).not.toHaveBeenCalled();
  });

  it('returns 200 even on processing error', async () => {
    mockUpsertCustomerByLineUserId.mockRejectedValue(new Error('DB connection failed'));

    const request = createWebhookRequest([
      {
        type: 'follow',
        source: { type: 'user', userId: 'U-fail' },
        timestamp: Date.now(),
      },
    ]);

    const response = await webhookPOST(request);
    const body = await response.json();

    // LINE requires 200 even on errors
    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
  });
});

describe('GET /api/line/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns customer list', async () => {
    const mockCustomers = [
      { id: 'cust-001', lineUserId: 'U001', displayName: 'Taro' },
      { id: 'cust-002', lineUserId: 'U002', displayName: 'Hanako' },
    ];
    mockGetCustomers.mockResolvedValue({
      customers: mockCustomers,
      total: 2,
      page: 1,
      perPage: 100,
    });

    const response = await webhookGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.customers).toHaveLength(2);
    expect(body.count).toBe(2);
    expect(mockGetCustomers).toHaveBeenCalledWith({
      perPage: 100,
      sortBy: 'last_seen_at',
      sortOrder: 'desc',
    });
  });
});

// ===========================================================================
// Cron: line-broadcast
// ===========================================================================

describe('GET /api/cron/line-broadcast', () => {
  const CRON_SECRET = 'test-cron-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it('returns 401 without CRON_SECRET', async () => {
    const request = createCronRequest('/api/cron/line-broadcast', false);

    const response = await lineBroadcastGET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('skips when schedule disabled', async () => {
    mockStorageGetSchedule.mockResolvedValue({ enabled: false });
    mockLogExecution.mockResolvedValue(undefined);

    const request = createCronRequest('/api/cron/line-broadcast');

    const response = await lineBroadcastGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.skipped).toBe(true);
    expect(mockLogExecution).toHaveBeenCalledWith('CRON', 'SKIP', 'スケジュール無効');
    expect(mockScrapeLatestArticles).not.toHaveBeenCalled();
  });

  it('processes new articles', async () => {
    mockStorageGetSchedule.mockResolvedValue({
      enabled: true,
      maxArticlesPerRun: 2,
      templateId: 'tmpl-001',
    });
    mockStorageGetSentUrls.mockResolvedValue(['https://example.com/old']);
    mockScrapeLatestArticles.mockResolvedValue([
      { url: 'https://example.com/old', title: 'Old Article', thumbnailUrl: null, category: null },
      { url: 'https://example.com/new1', title: 'New Article 1', thumbnailUrl: 'https://img/1.jpg', category: 'tech' },
    ]);
    mockSummarizeArticle.mockResolvedValue({
      catchyTitle: 'Catchy Title',
      summaryText: 'Summary of the article',
    });
    mockBroadcastArticle.mockResolvedValue({
      success: true,
      sentAt: '2026-03-25T10:00:00Z',
    });
    mockStorageAddSentUrl.mockResolvedValue(undefined);
    mockStorageResetConsecutiveErrors.mockResolvedValue(undefined);
    mockLogExecution.mockResolvedValue(undefined);

    const request = createCronRequest('/api/cron/line-broadcast');

    const response = await lineBroadcastGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].url).toBe('https://example.com/new1');
    expect(body.results[0].success).toBe(true);

    expect(mockScrapeLatestArticles).toHaveBeenCalled();
    expect(mockSummarizeArticle).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/new1' }),
    );
    expect(mockBroadcastArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        articleUrl: 'https://example.com/new1',
        summaryTitle: 'Catchy Title',
        templateId: 'tmpl-001',
      }),
    );
    expect(mockStorageAddSentUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/new1',
        status: 'SUCCESS',
      }),
    );
    expect(mockStorageResetConsecutiveErrors).toHaveBeenCalled();
  });
});

// ===========================================================================
// Cron: reservation-reminder
// ===========================================================================

describe('GET /api/cron/reservation-reminder', () => {
  const CRON_SECRET = 'test-cron-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it('returns 401 without auth', async () => {
    const request = createCronRequest('/api/cron/reservation-reminder', false);

    const response = await reservationReminderGET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('sends reminders for upcoming reservations', async () => {
    const futureDate = new Date(Date.now() + 30 * 60 * 1000);
    const dateStr = futureDate.toISOString().slice(0, 10);
    const timeStr = futureDate.toISOString().slice(11, 19);

    mockGetUpcomingReservationsForReminder.mockResolvedValue([
      {
        id: 'res-001',
        customerId: 'cust-001',
        date: dateStr,
        startTime: timeStr,
        endTime: '18:00:00',
        consultantName: 'Dr. Tanaka',
        meetUrl: 'https://meet.google.com/abc',
      },
    ]);
    mockGetCustomerById.mockResolvedValue({
      id: 'cust-001',
      lineUserId: 'U001',
      displayName: 'Taro',
    });
    mockFetch.mockResolvedValue({ ok: true });
    mockMarkReminderSent.mockResolvedValue(undefined);

    const request = createCronRequest('/api/cron/reservation-reminder');

    const response = await reservationReminderGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(body.total).toBe(1);
    expect(mockGetUpcomingReservationsForReminder).toHaveBeenCalledWith(1);
    expect(mockGetCustomerById).toHaveBeenCalledWith('cust-001');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('U001'),
      }),
    );
    expect(mockMarkReminderSent).toHaveBeenCalledWith('res-001');
  });

  it('skips when no upcoming reservations', async () => {
    mockGetUpcomingReservationsForReminder.mockResolvedValue([]);

    const request = createCronRequest('/api/cron/reservation-reminder');

    const response = await reservationReminderGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(0);
    expect(mockGetCustomerById).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Cron: ma-executor
// ===========================================================================

describe('GET /api/cron/ma-executor', () => {
  const CRON_SECRET = 'test-cron-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it('processes active scenarios', async () => {
    mockGetScenarios.mockResolvedValue([
      {
        id: 'sc-001',
        name: 'Welcome Flow',
        triggerType: 'event',
        triggerConfig: { eventType: 'follow' },
        steps: [],
        isActive: true,
        stats: { sent: 0, opened: 0, clicked: 0 },
        lastExecutedAt: null,
      },
      {
        id: 'sc-002',
        name: 'Inactive Flow',
        triggerType: 'event',
        triggerConfig: { eventType: 'purchase' },
        steps: [],
        isActive: false,
        stats: { sent: 0, opened: 0, clicked: 0 },
        lastExecutedAt: null,
      },
    ]);

    // Mock the supabase query for matching customer_actions
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            then: (resolve: (v: unknown) => void) =>
              resolve({ data: [{ customer_id: 'cust-100' }], error: null }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null }),
        }),
      }),
    });

    mockLogScenarioExecution.mockResolvedValue(undefined);
    mockUpdateScenarioStats.mockResolvedValue(undefined);

    const request = createCronRequest('/api/cron/ma-executor');

    const response = await maExecutorGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activeScenarios).toBe(1);
    expect(body.processed).toBeGreaterThanOrEqual(1);
    expect(mockGetScenarios).toHaveBeenCalled();
    expect(mockLogScenarioExecution).toHaveBeenCalledWith(
      'sc-001',
      'cust-100',
      0,
      'sent',
      { trigger: 'event' },
    );
  });

  it('skips inactive scenarios', async () => {
    mockGetScenarios.mockResolvedValue([
      {
        id: 'sc-inactive',
        name: 'Disabled Flow',
        triggerType: 'event',
        triggerConfig: { eventType: 'follow' },
        steps: [],
        isActive: false,
        stats: { sent: 0, opened: 0, clicked: 0 },
        lastExecutedAt: null,
      },
    ]);

    const request = createCronRequest('/api/cron/ma-executor');

    const response = await maExecutorGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activeScenarios).toBe(0);
    expect(body.processed).toBe(0);
    expect(mockLogScenarioExecution).not.toHaveBeenCalled();
  });
});
