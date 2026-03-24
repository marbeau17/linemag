// ============================================================================
// tests/unit/storage.test.ts
// FileStorage + storage-factory unit tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 'fs' (not 'fs/promises') because source uses: import { promises as fs } from 'fs'
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

import { promises as fs } from 'fs';
import { FileStorage } from '@/lib/line/storage';
import type { BroadcastRecord } from '@/lib/line/storage';

const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockRename = vi.mocked(fs.rename);

// ─── helpers ────────────────────────────────────────────────────────────────

function makeBroadcastRecord(overrides: Partial<BroadcastRecord> = {}): BroadcastRecord {
  return {
    url: 'https://example.com/article-1',
    title: 'Test Article',
    sentAt: '2026-03-25T09:00:00.000Z',
    status: 'SUCCESS',
    ...overrides,
  };
}

// ─── FileStorage tests ─────────────────────────────────────────────────────

describe('FileStorage', () => {
  let storage: FileStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new FileStorage();
    // Default: readFile throws (file not found)
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    // Default: rename succeeds
    mockRename.mockResolvedValue(undefined);
  });

  // ── getSentUrls ──

  describe('getSentUrls()', () => {
    it('returns empty array when file does not exist', async () => {
      const result = await storage.getSentUrls();
      expect(result).toEqual([]);
    });

    it('returns parsed URLs from file', async () => {
      const urls = ['https://example.com/a', 'https://example.com/b'];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(urls));

      const result = await storage.getSentUrls();
      expect(result).toEqual(urls);
    });
  });

  // ── addSentUrl ──

  describe('addSentUrl()', () => {
    it('adds URL to sent list and broadcast history', async () => {
      // Both files don't exist initially (default mock returns ENOENT)
      const record = makeBroadcastRecord();

      await storage.addSentUrl(record);

      // writeFile is called for both sent-urls and broadcast-history
      // Each writeJson call triggers writeFile once (to .tmp file)
      expect(mockWriteFile).toHaveBeenCalledTimes(2);

      // Verify sent-urls content (first write)
      const sentUrlsCall = mockWriteFile.mock.calls[0];
      expect(sentUrlsCall[0]).toMatch(/line-sent-urls\.json\.tmp$/);
      expect(JSON.parse(sentUrlsCall[1] as string)).toEqual([record.url]);

      // Verify broadcast-history content (second write)
      const historyCall = mockWriteFile.mock.calls[1];
      expect(historyCall[0]).toMatch(/line-broadcast-history\.json\.tmp$/);
      expect(JSON.parse(historyCall[1] as string)).toEqual([record]);
    });

    it('deduplicates URLs — does not add same URL twice to sent list', async () => {
      const record = makeBroadcastRecord({ url: 'https://example.com/dup' });
      const existingUrls = ['https://example.com/dup'];

      // First readFile (getSentUrls) returns existing URL
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(existingUrls))
        // Second readFile (getBroadcastHistory) returns empty
        .mockRejectedValueOnce(new Error('ENOENT'));

      await storage.addSentUrl(record);

      // Only 1 write: broadcast-history (sent-urls skipped because URL already exists)
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const historyCall = mockWriteFile.mock.calls[0];
      expect(historyCall[0]).toMatch(/line-broadcast-history\.json\.tmp$/);
    });
  });

  // ── getBroadcastHistory ──

  describe('getBroadcastHistory()', () => {
    it('returns records limited by limit parameter', async () => {
      const records = Array.from({ length: 10 }, (_, i) =>
        makeBroadcastRecord({ url: `https://example.com/${i}` }),
      );
      mockReadFile.mockResolvedValueOnce(JSON.stringify(records));

      const result = await storage.getBroadcastHistory(3);
      expect(result).toHaveLength(3);
      expect(result[0].url).toBe('https://example.com/0');
      expect(result[2].url).toBe('https://example.com/2');
    });
  });

  // ── addExecutionLog ──

  describe('addExecutionLog()', () => {
    it('adds log entry with generated id and timestamp', async () => {
      const now = new Date('2026-03-25T10:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      await storage.addExecutionLog({
        step: 'SCRAPE',
        result: 'SUCCESS',
        detail: 'Scraped 3 articles',
      });

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written).toHaveLength(1);
      expect(written[0]).toMatchObject({
        step: 'SCRAPE',
        result: 'SUCCESS',
        detail: 'Scraped 3 articles',
        executedAt: '2026-03-25T10:00:00.000Z',
      });
      expect(written[0].id).toMatch(/^\d+-[a-z0-9]+$/);

      vi.useRealTimers();
    });
  });

  // ── getExecutionLogs ──

  describe('getExecutionLogs()', () => {
    it('returns logs sorted by time (newest first, as stored)', async () => {
      const logs = [
        { id: '2', executedAt: '2026-03-25T11:00:00Z', step: 'BROADCAST', result: 'SUCCESS', detail: 'b' },
        { id: '1', executedAt: '2026-03-25T10:00:00Z', step: 'SCRAPE', result: 'SUCCESS', detail: 'a' },
      ];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(logs));

      const result = await storage.getExecutionLogs();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('1');
    });
  });

  // ── getLogsByStep ──

  describe('getLogsByStep()', () => {
    it('filters logs by step', async () => {
      const logs = [
        { id: '3', executedAt: '2026-03-25T12:00:00Z', step: 'SCRAPE', result: 'SUCCESS', detail: 'c' },
        { id: '2', executedAt: '2026-03-25T11:00:00Z', step: 'BROADCAST', result: 'SUCCESS', detail: 'b' },
        { id: '1', executedAt: '2026-03-25T10:00:00Z', step: 'SCRAPE', result: 'ERROR', detail: 'a' },
      ];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(logs));

      const result = await storage.getLogsByStep('SCRAPE');
      expect(result).toHaveLength(2);
      expect(result.every((l) => l.step === 'SCRAPE')).toBe(true);
    });
  });

  // ── getSchedule ──

  describe('getSchedule()', () => {
    it('returns default schedule when file is missing', async () => {
      const result = await storage.getSchedule();
      expect(result).toEqual({
        enabled: false,
        times: ['09:00', '18:00'],
        templateId: 'daily-column',
        maxArticlesPerRun: 3,
      });
    });
  });

  // ── saveSchedule ──

  describe('saveSchedule()', () => {
    it('persists schedule config to file', async () => {
      const schedule = {
        enabled: true,
        times: ['07:00', '12:00', '20:00'],
        templateId: 'news-card' as const,
        maxArticlesPerRun: 5,
      };

      await storage.saveSchedule(schedule);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written).toEqual(schedule);
    });
  });

  // ── getConsecutiveErrorCount ──

  describe('getConsecutiveErrorCount()', () => {
    it('returns 0 when no error tracking file exists', async () => {
      const result = await storage.getConsecutiveErrorCount();
      expect(result).toBe(0);
    });
  });

  // ── incrementConsecutiveErrors ──

  describe('incrementConsecutiveErrors()', () => {
    it('increments from 0 and returns new count', async () => {
      // File doesn't exist, falls back to { consecutiveErrors: 0 }
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-25T10:00:00.000Z'));

      const result = await storage.incrementConsecutiveErrors();
      expect(result).toBe(1);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written).toEqual({
        consecutiveErrors: 1,
        lastErrorAt: '2026-03-25T10:00:00.000Z',
      });

      vi.useRealTimers();
    });

    it('increments existing count', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ consecutiveErrors: 3, lastErrorAt: '2026-03-25T09:00:00.000Z' }),
      );

      const result = await storage.incrementConsecutiveErrors();
      expect(result).toBe(4);
    });
  });

  // ── resetConsecutiveErrors ──

  describe('resetConsecutiveErrors()', () => {
    it('resets error count to 0', async () => {
      await storage.resetConsecutiveErrors();

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written).toEqual({
        consecutiveErrors: 0,
        lastErrorAt: null,
      });
    });
  });
});

// ─── Storage Factory tests ──────────────────────────────────────────────────

describe('storage-factory', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns FileStorage when STORAGE_BACKEND=file', async () => {
    process.env.STORAGE_BACKEND = 'file';
    const { storage } = await import('@/lib/line/storage-factory');
    const { FileStorage } = await import('@/lib/line/storage');
    expect(storage).toBeInstanceOf(FileStorage);
    delete process.env.STORAGE_BACKEND;
  });

  it('returns SupabaseStorage when STORAGE_BACKEND=supabase', async () => {
    process.env.STORAGE_BACKEND = 'supabase';
    const { storage } = await import('@/lib/line/storage-factory');
    const { SupabaseStorage } = await import('@/lib/line/supabase-storage');
    expect(storage).toBeInstanceOf(SupabaseStorage);
    delete process.env.STORAGE_BACKEND;
  });
});
