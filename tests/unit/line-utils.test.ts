// ============================================================================
// tests/unit/line-utils.test.ts
// Unit tests for config, retry, logger utility modules
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Config tests ───────────────────────────────────────────────────────────

describe('config', () => {
  // Import fresh each time so getter side-effects (env reads) are testable
  let config: typeof import('@/lib/line/config').config;

  beforeEach(async () => {
    // Provide defaults so the module can be imported without throwing
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    process.env.GEMINI_API_KEY = 'test-api-key';

    // Dynamic import to pick up env vars set above
    const mod = await import('@/lib/line/config');
    config = mod.config;
  });

  afterEach(() => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.GEMINI_API_KEY;
  });

  it('has all required top-level sections', () => {
    expect(config).toHaveProperty('blog');
    expect(config).toHaveProperty('gemini');
    expect(config).toHaveProperty('line');
    expect(config).toHaveProperty('summary');
    expect(config).toHaveProperty('storage');
    expect(config).toHaveProperty('retry');
    expect(config).toHaveProperty('cron');
  });

  it('blog.url is the expected URL', () => {
    expect(config.blog.url).toBe('https://meetsc.co.jp/blog/');
  });

  it('gemini.model is gemini-2.0-flash', () => {
    expect(config.gemini.model).toBe('gemini-2.0-flash');
  });

  it('line.broadcastUrl and pushUrl are correct', () => {
    expect(config.line.broadcastUrl).toBe(
      'https://api.line.me/v2/bot/message/broadcast',
    );
    expect(config.line.pushUrl).toBe(
      'https://api.line.me/v2/bot/message/push',
    );
  });

  it('summary min/max lengths are valid numbers with min < max', () => {
    expect(config.summary.minLength).toBeGreaterThan(0);
    expect(config.summary.absoluteMaxLength).toBeGreaterThan(
      config.summary.minLength,
    );
    expect(config.summary.targetMinLength).toBeLessThan(
      config.summary.targetMaxLength,
    );
  });

  it('line.channelAccessToken throws when env var is not set', () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    expect(() => config.line.channelAccessToken).toThrow(
      'LINE_CHANNEL_ACCESS_TOKEN is not set',
    );
  });

  it('gemini.apiKey throws when env var is not set', () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => config.gemini.apiKey).toThrow('GEMINI_API_KEY is not set');
  });
});

// ─── Retry tests ────────────────────────────────────────────────────────────

describe('withRetry', () => {
  let withRetry: typeof import('@/lib/line/retry').withRetry;
  let HttpError: typeof import('@/lib/line/retry').HttpError;

  beforeEach(async () => {
    vi.useFakeTimers();
    const mod = await import('@/lib/line/retry');
    withRetry = mod.withRetry;
    HttpError = mod.HttpError;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the value on the first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const resultPromise = withRetry(fn, { maxRetries: 2, delayMs: 100 });
    const result = await resultPromise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue('ok');

    const resultPromise = withRetry(fn, { maxRetries: 3, delayMs: 100 });

    // Advance through the two sleep periods
    await vi.advanceTimersByTimeAsync(100); // 1st retry delay (100 * 1)
    await vi.advanceTimersByTimeAsync(200); // 2nd retry delay (100 * 2)

    const result = await resultPromise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always-fail'));

    const resultPromise = withRetry(fn, { maxRetries: 2, delayMs: 100 });

    // Advance through retry delays
    await vi.advanceTimersByTimeAsync(100); // 1st retry delay
    await vi.advanceTimersByTimeAsync(200); // 2nd retry delay

    await expect(resultPromise).rejects.toThrow('always-fail');
    // initial attempt + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ─── Logger tests ───────────────────────────────────────────────────────────

// Mock storage-factory before importing logger
vi.mock('@/lib/line/storage-factory', () => ({
  storage: {
    addExecutionLog: vi.fn(),
    getExecutionLogs: vi.fn(),
    getLogsByStep: vi.fn(),
  },
}));

import { storage } from '@/lib/line/storage-factory';
import { logExecution, getLogs } from '@/lib/line/logger';

const mockStorage = vi.mocked(storage);

describe('logExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls storage.addExecutionLog with the correct payload', async () => {
    mockStorage.addExecutionLog.mockResolvedValue(undefined);

    await logExecution('SCRAPE', 'SUCCESS', 'Scraped 3 articles', {
      count: 3,
    });

    expect(mockStorage.addExecutionLog).toHaveBeenCalledOnce();
    expect(mockStorage.addExecutionLog).toHaveBeenCalledWith({
      step: 'SCRAPE',
      result: 'SUCCESS',
      detail: 'Scraped 3 articles',
      metadata: { count: 3 },
    });
  });

  it('handles storage errors gracefully without throwing', async () => {
    mockStorage.addExecutionLog.mockRejectedValue(new Error('disk full'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should NOT throw
    await expect(
      logExecution('BROADCAST', 'ERROR', 'Something went wrong'),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[logger] Failed to write log:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});

describe('getLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls storage.getExecutionLogs when no step is provided', async () => {
    const fakeLogs = [
      {
        id: '1',
        executedAt: '2026-03-25T00:00:00Z',
        step: 'SCRAPE' as const,
        result: 'SUCCESS' as const,
        detail: 'ok',
      },
    ];
    mockStorage.getExecutionLogs.mockResolvedValue(fakeLogs);

    const result = await getLogs(10);

    expect(mockStorage.getExecutionLogs).toHaveBeenCalledWith(10);
    expect(result).toEqual(fakeLogs);
  });

  it('calls storage.getLogsByStep when step is provided', async () => {
    mockStorage.getLogsByStep.mockResolvedValue([]);

    const result = await getLogs(10, 'SUMMARIZE');

    expect(mockStorage.getLogsByStep).toHaveBeenCalledWith('SUMMARIZE', 10);
    expect(result).toEqual([]);
  });
});
