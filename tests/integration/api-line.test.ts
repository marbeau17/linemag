// ============================================================================
// tests/integration/api-line.test.ts
// Integration tests for LINE API route handlers
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

vi.mock('@/lib/line/storage-factory', () => ({
  storage: {
    getBroadcastHistory: vi.fn(),
    getSchedule: vi.fn(),
    saveSchedule: vi.fn(),
  },
}));

vi.mock('@/lib/line/scraper', () => ({
  fetchArticleList: vi.fn(),
  getAndClearLogs: vi.fn(),
}));

vi.mock('@/lib/line/messaging', () => ({
  broadcastArticle: vi.fn(),
  testBroadcastArticle: vi.fn(),
}));

vi.mock('@/lib/line/logger', () => ({
  getLogs: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import mocked modules & route handlers
// ---------------------------------------------------------------------------

import { storage } from '@/lib/line/storage-factory';
import { fetchArticleList, getAndClearLogs } from '@/lib/line/scraper';
import { broadcastArticle, testBroadcastArticle } from '@/lib/line/messaging';
import { getLogs } from '@/lib/line/logger';

import { GET as historyGET } from '@/app/api/line/history/route';
import { GET as scheduleGET, PUT as schedulePUT } from '@/app/api/line/schedule/route';
import { GET as logsGET } from '@/app/api/line/logs/route';
import { POST as scrapeListPOST } from '@/app/api/line/scrape-list/route';
import { POST as broadcastPOST } from '@/app/api/line/broadcast/route';
import { POST as testBroadcastPOST } from '@/app/api/line/test-broadcast/route';

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// GET /api/line/history
// ===========================================================================

describe('GET /api/line/history', () => {
  it('returns broadcast history', async () => {
    const mockHistory = [
      { id: '1', sentAt: '2026-03-25T10:00:00Z', articleTitle: 'Article 1' },
      { id: '2', sentAt: '2026-03-24T10:00:00Z', articleTitle: 'Article 2' },
    ];
    vi.mocked(storage.getBroadcastHistory).mockResolvedValue(mockHistory);

    const req = createRequest('/api/line/history');
    const res = await historyGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.history).toEqual(mockHistory);
    expect(storage.getBroadcastHistory).toHaveBeenCalledWith(50); // default limit
  });

  it('respects limit param', async () => {
    vi.mocked(storage.getBroadcastHistory).mockResolvedValue([]);

    const req = createRequest('/api/line/history?limit=10');
    const res = await historyGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.history).toEqual([]);
    expect(storage.getBroadcastHistory).toHaveBeenCalledWith(10);
  });
});

// ===========================================================================
// GET /api/line/schedule
// ===========================================================================

describe('GET /api/line/schedule', () => {
  it('returns schedule config', async () => {
    const mockSchedule = {
      enabled: true,
      times: ['08:00', '12:00'],
      templateId: 'daily-column',
      maxArticlesPerRun: 3,
    };
    vi.mocked(storage.getSchedule).mockResolvedValue(mockSchedule);

    const req = createRequest('/api/line/schedule');
    const res = await scheduleGET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(mockSchedule);
  });
});

// ===========================================================================
// PUT /api/line/schedule
// ===========================================================================

describe('PUT /api/line/schedule', () => {
  const currentSchedule = {
    enabled: false,
    times: ['09:00'],
    templateId: 'daily-column' as const,
    maxArticlesPerRun: 5,
  };

  it('updates schedule', async () => {
    vi.mocked(storage.getSchedule).mockResolvedValue(currentSchedule);
    vi.mocked(storage.saveSchedule).mockResolvedValue(undefined);

    const req = createRequest('/api/line/schedule', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true, times: ['08:00', '18:00'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await schedulePUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.schedule.enabled).toBe(true);
    expect(body.schedule.times).toEqual(['08:00', '18:00']);
    // Fields not sent should keep current values
    expect(body.schedule.templateId).toBe('daily-column');
    expect(body.schedule.maxArticlesPerRun).toBe(5);
    expect(storage.saveSchedule).toHaveBeenCalledOnce();
  });

  it('validates body — returns 500 on invalid JSON', async () => {
    const req = createRequest('/api/line/schedule', {
      method: 'PUT',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await schedulePUT(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ===========================================================================
// GET /api/line/logs
// ===========================================================================

describe('GET /api/line/logs', () => {
  it('returns execution logs', async () => {
    const mockLogs = [
      { step: 'SCRAPE', message: 'Fetched articles', timestamp: '2026-03-25T10:00:00Z' },
      { step: 'BROADCAST', message: 'Sent message', timestamp: '2026-03-25T10:01:00Z' },
    ];
    vi.mocked(getLogs).mockResolvedValue(mockLogs);

    const req = createRequest('/api/line/logs');
    const res = await logsGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.logs).toEqual(mockLogs);
    expect(getLogs).toHaveBeenCalledWith(100, undefined); // default limit, no step
  });

  it('filters by step', async () => {
    vi.mocked(getLogs).mockResolvedValue([]);

    const req = createRequest('/api/line/logs?step=SCRAPE');
    const res = await logsGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.logs).toEqual([]);
    expect(getLogs).toHaveBeenCalledWith(100, 'SCRAPE');
  });
});

// ===========================================================================
// POST /api/line/scrape-list
// ===========================================================================

describe('POST /api/line/scrape-list', () => {
  it('returns article list', async () => {
    const mockArticles = [
      { url: 'https://example.com/1', title: 'Article 1' },
      { url: 'https://example.com/2', title: 'Article 2' },
    ];
    vi.mocked(fetchArticleList).mockResolvedValue(mockArticles as any);
    vi.mocked(getAndClearLogs).mockReturnValue([]);

    const req = createRequest('/api/line/scrape-list', { method: 'POST' });
    const res = await scrapeListPOST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.articles).toEqual(mockArticles);
    expect(body.count).toBe(2);
    expect(body.logs).toEqual([]);
  });
});

// ===========================================================================
// POST /api/line/broadcast
// ===========================================================================

describe('POST /api/line/broadcast', () => {
  const validPayload = {
    articleUrl: 'https://example.com/article',
    articleTitle: 'Test Article',
    summaryTitle: 'Summary Title',
    summaryText: 'Summary text content',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    templateId: 'daily-column',
  };

  it('sends broadcast successfully', async () => {
    vi.mocked(broadcastArticle).mockResolvedValue({
      success: true,
      sentAt: '2026-03-25T10:00:00Z',
    });

    const req = createRequest('/api/line/broadcast', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await broadcastPOST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sentAt).toBe('2026-03-25T10:00:00Z');
    expect(broadcastArticle).toHaveBeenCalledOnce();
  });

  it('returns 400 when required params are missing', async () => {
    const req = createRequest('/api/line/broadcast', {
      method: 'POST',
      body: JSON.stringify({ articleUrl: 'https://example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await broadcastPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(broadcastArticle).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// POST /api/line/test-broadcast
// ===========================================================================

describe('POST /api/line/test-broadcast', () => {
  const validPayload = {
    articleUrl: 'https://example.com/article',
    articleTitle: 'Test Article',
    summaryTitle: 'Summary Title',
    summaryText: 'Summary text content',
    thumbnailUrl: null,
    templateId: 'news-card',
  };

  it('sends test broadcast successfully', async () => {
    vi.mocked(testBroadcastArticle).mockResolvedValue({
      success: true,
      sentAt: '2026-03-25T11:00:00Z',
    });

    const req = createRequest('/api/line/test-broadcast', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await testBroadcastPOST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sentAt).toBe('2026-03-25T11:00:00Z');
    expect(testBroadcastArticle).toHaveBeenCalledOnce();
  });

  it('returns 400 when required params are missing', async () => {
    const req = createRequest('/api/line/test-broadcast', {
      method: 'POST',
      body: JSON.stringify({ templateId: 'news-card' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await testBroadcastPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(testBroadcastArticle).not.toHaveBeenCalled();
  });
});
