// ============================================================================
// src/lib/line/storage.ts
// 永続ストレージ — 配信履歴・実行ログ・スケジュール管理
// ============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config';
import type { ScheduleConfig, TemplateId } from '@/types/line';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface BroadcastRecord {
  url: string;
  title: string;
  sentAt: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  templateId?: string;
}

export interface ExecutionLog {
  id: string;
  executedAt: string;
  step: 'SCRAPE' | 'SUMMARIZE' | 'BROADCAST' | 'CRON';
  result: 'SUCCESS' | 'ERROR' | 'SKIP';
  detail: string;
  metadata?: Record<string, unknown>;
}

interface ErrorTracking {
  consecutiveErrors: number;
  lastErrorAt: string | null;
}

// ─── ファイルパス ────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), config.storage.dataDir);
const SENT_FILE = path.join(DATA_DIR, 'line-sent-urls.json');
const HISTORY_FILE = path.join(DATA_DIR, 'line-broadcast-history.json');
const SCHEDULE_FILE = path.join(DATA_DIR, 'line-schedule.json');
const LOGS_FILE = path.join(DATA_DIR, 'execution-logs.json');
const ERROR_FILE = path.join(DATA_DIR, 'error-tracking.json');

const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: false,
  times: ['09:00', '18:00'],
  templateId: 'daily-column' as TemplateId,
  maxArticlesPerRun: 3,
};

// ─── ユーティリティ ──────────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await ensureDir();
  const tmpFile = filePath + '.tmp';
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  try {
    await fs.rename(tmpFile, filePath);
  } catch {
    // Windows では rename が失敗する場合がある
    await fs.copyFile(tmpFile, filePath);
    await fs.unlink(tmpFile).catch(() => {});
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ─── ストレージクラス ────────────────────────────────────────────────────────

export class FileStorage {
  // ── 送信済みURL ──

  async getSentUrls(): Promise<string[]> {
    return readJson<string[]>(SENT_FILE, []);
  }

  async addSentUrl(record: BroadcastRecord): Promise<void> {
    // 送信済みURLリスト更新
    const urls = await this.getSentUrls();
    if (!urls.includes(record.url)) {
      urls.push(record.url);
      await writeJson(SENT_FILE, urls.slice(-config.storage.maxSentUrls));
    }
    // 配信履歴追加
    const history = await this.getBroadcastHistory();
    history.unshift(record);
    await writeJson(HISTORY_FILE, history.slice(0, config.storage.maxHistoryEntries));
  }

  async getBroadcastHistory(limit = 50): Promise<BroadcastRecord[]> {
    const records = await readJson<BroadcastRecord[]>(HISTORY_FILE, []);
    return records.slice(0, limit);
  }

  // ── 実行ログ ──

  async addExecutionLog(
    entry: Omit<ExecutionLog, 'id' | 'executedAt'>,
  ): Promise<void> {
    const logs = await readJson<ExecutionLog[]>(LOGS_FILE, []);
    logs.unshift({
      id: generateId(),
      executedAt: new Date().toISOString(),
      ...entry,
    });
    await writeJson(LOGS_FILE, logs.slice(0, config.storage.maxLogEntries));
  }

  async getExecutionLogs(limit = 100): Promise<ExecutionLog[]> {
    const logs = await readJson<ExecutionLog[]>(LOGS_FILE, []);
    return logs.slice(0, limit);
  }

  async getLogsByStep(step: string, limit = 100): Promise<ExecutionLog[]> {
    const logs = await this.getExecutionLogs(config.storage.maxLogEntries);
    return logs.filter((l) => l.step === step).slice(0, limit);
  }

  // ── スケジュール ──

  async getSchedule(): Promise<ScheduleConfig> {
    return readJson<ScheduleConfig>(SCHEDULE_FILE, { ...DEFAULT_SCHEDULE });
  }

  async saveSchedule(scheduleConfig: ScheduleConfig): Promise<void> {
    await writeJson(SCHEDULE_FILE, scheduleConfig);
  }

  // ── エラー追跡 ──

  async getConsecutiveErrorCount(): Promise<number> {
    const tracking = await readJson<ErrorTracking>(ERROR_FILE, {
      consecutiveErrors: 0,
      lastErrorAt: null,
    });
    return tracking.consecutiveErrors;
  }

  async incrementConsecutiveErrors(): Promise<number> {
    const tracking = await readJson<ErrorTracking>(ERROR_FILE, {
      consecutiveErrors: 0,
      lastErrorAt: null,
    });
    tracking.consecutiveErrors += 1;
    tracking.lastErrorAt = new Date().toISOString();
    await writeJson(ERROR_FILE, tracking);
    return tracking.consecutiveErrors;
  }

  async resetConsecutiveErrors(): Promise<void> {
    await writeJson(ERROR_FILE, {
      consecutiveErrors: 0,
      lastErrorAt: null,
    });
  }
}

// singleton は storage-factory.ts から提供される
// 直接インポートする場合: import { storage } from './storage-factory'
export const fileStorage = new FileStorage();
