// ============================================================================
// src/lib/line/supabase-storage.ts
// Supabase バックエンド — FileStorage と同一インターフェース
// ============================================================================

import { getAdminClient } from '@/lib/supabase/admin';
import { config } from './config';
import type { ScheduleConfig, TemplateId } from '@/types/line';
import type { BroadcastRecord, ExecutionLog } from './storage';

const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: false,
  times: ['09:00', '18:00'],
  templateId: 'daily-column' as TemplateId,
  maxArticlesPerRun: 3,
};

// DB行の型定義
interface SentUrlRow {
  url: string;
}

interface BroadcastRow {
  url: string;
  title: string;
  sent_at: string;
  status: string;
  error_message: string | null;
  template_id: string | null;
}

interface ExecutionLogRow {
  id: string;
  executed_at: string;
  step: string;
  result: string;
  detail: string;
  metadata: Record<string, unknown> | null;
}

interface ScheduleRow {
  enabled: boolean;
  times: string[];
  template_id: string;
  max_articles_per_run: number;
}

interface ErrorTrackingRow {
  consecutive_errors: number;
}

export class SupabaseStorage {
  private get db() {
    return getAdminClient();
  }

  // ── 送信済みURL ──

  async getSentUrls(): Promise<string[]> {
    const { data, error } = await this.db
      .from('sent_urls')
      .select('url')
      .order('created_at', { ascending: false })
      .limit(config.storage.maxSentUrls);

    if (error) throw new Error(`getSentUrls failed: ${error.message}`);
    return ((data ?? []) as SentUrlRow[]).map((row) => row.url);
  }

  async addSentUrl(record: BroadcastRecord): Promise<void> {
    // 送信済みURLリスト更新（重複は無視）
    await this.db
      .from('sent_urls')
      .upsert({ url: record.url } as never, { onConflict: 'url' });

    // 配信履歴追加
    const { error } = await this.db.from('broadcasts').insert({
      url: record.url,
      title: record.title,
      template_id: record.templateId ?? null,
      status: record.status,
      error_message: record.error ?? null,
      sent_at: record.sentAt,
    } as never);

    if (error) throw new Error(`addSentUrl failed: ${error.message}`);
  }

  // ── 配信履歴 ──

  async getBroadcastHistory(limit = 50): Promise<BroadcastRecord[]> {
    const { data, error } = await this.db
      .from('broadcasts')
      .select('url, title, sent_at, status, error_message, template_id')
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`getBroadcastHistory failed: ${error.message}`);

    return ((data ?? []) as BroadcastRow[]).map((row) => ({
      url: row.url,
      title: row.title,
      sentAt: row.sent_at,
      status: row.status as 'SUCCESS' | 'FAILED',
      error: row.error_message ?? undefined,
      templateId: row.template_id ?? undefined,
    }));
  }

  // ── 実行ログ ──

  async addExecutionLog(
    entry: Omit<ExecutionLog, 'id' | 'executedAt'>,
  ): Promise<void> {
    const { error } = await this.db.from('execution_logs').insert({
      step: entry.step,
      result: entry.result,
      detail: entry.detail,
      metadata: entry.metadata ?? {},
    } as never);

    if (error) throw new Error(`addExecutionLog failed: ${error.message}`);
  }

  async getExecutionLogs(limit = 100): Promise<ExecutionLog[]> {
    const { data, error } = await this.db
      .from('execution_logs')
      .select('id, executed_at, step, result, detail, metadata')
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`getExecutionLogs failed: ${error.message}`);
    return ((data ?? []) as ExecutionLogRow[]).map(mapExecutionLog);
  }

  async getLogsByStep(step: string, limit = 100): Promise<ExecutionLog[]> {
    const { data, error } = await this.db
      .from('execution_logs')
      .select('id, executed_at, step, result, detail, metadata')
      .eq('step', step)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`getLogsByStep failed: ${error.message}`);
    return ((data ?? []) as ExecutionLogRow[]).map(mapExecutionLog);
  }

  // ── スケジュール ──

  async getSchedule(): Promise<ScheduleConfig> {
    const { data, error } = await this.db
      .from('schedules')
      .select('enabled, times, template_id, max_articles_per_run')
      .eq('key', 'default')
      .single();

    if (error || !data) return { ...DEFAULT_SCHEDULE };

    const row = data as ScheduleRow;
    return {
      enabled: row.enabled,
      times: row.times,
      templateId: row.template_id as TemplateId,
      maxArticlesPerRun: row.max_articles_per_run,
    };
  }

  async saveSchedule(scheduleConfig: ScheduleConfig): Promise<void> {
    const { error } = await this.db
      .from('schedules')
      .upsert(
        {
          key: 'default',
          enabled: scheduleConfig.enabled,
          times: scheduleConfig.times,
          template_id: scheduleConfig.templateId,
          max_articles_per_run: scheduleConfig.maxArticlesPerRun,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'key' },
      );

    if (error) throw new Error(`saveSchedule failed: ${error.message}`);
  }

  // ── エラー追跡 ──

  async getConsecutiveErrorCount(): Promise<number> {
    const { data, error } = await this.db
      .from('error_trackings')
      .select('consecutive_errors')
      .eq('key', 'default')
      .single();

    if (error || !data) return 0;
    return (data as ErrorTrackingRow).consecutive_errors;
  }

  async incrementConsecutiveErrors(): Promise<number> {
    const { data, error } = await this.db.rpc(
      'increment_consecutive_errors' as never,
      { p_key: 'default' } as never,
    );

    if (error) throw new Error(`incrementConsecutiveErrors failed: ${error.message}`);
    return data as number;
  }

  async resetConsecutiveErrors(): Promise<void> {
    const { error } = await this.db
      .from('error_trackings')
      .update({
        consecutive_errors: 0,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('key', 'default');

    if (error) throw new Error(`resetConsecutiveErrors failed: ${error.message}`);
  }
}

// ── ヘルパー ──

function mapExecutionLog(row: ExecutionLogRow): ExecutionLog {
  return {
    id: row.id,
    executedAt: row.executed_at,
    step: row.step as ExecutionLog['step'],
    result: row.result as ExecutionLog['result'],
    detail: row.detail,
    metadata: row.metadata ?? undefined,
  };
}
