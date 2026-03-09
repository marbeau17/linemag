// ============================================================================
// src/lib/line/logger.ts
// 実行ログ記録 — 各処理ステップの結果を永続化
// ============================================================================

import { storage } from './storage';
import type { ExecutionLog } from './storage';

type LogStep = ExecutionLog['step'];
type LogResult = ExecutionLog['result'];

/**
 * 実行ログを記録するユーティリティ
 */
export async function logExecution(
  step: LogStep,
  result: LogResult,
  detail: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await storage.addExecutionLog({ step, result, detail, metadata });
    const prefix = `[logger:${step}]`;
    if (result === 'ERROR') {
      console.error(prefix, detail, metadata || '');
    } else {
      console.log(prefix, result, detail);
    }
  } catch (error) {
    // ログ記録自体のエラーは処理を止めない
    console.error('[logger] Failed to write log:', error);
  }
}

/**
 * 実行ログを取得
 */
export async function getLogs(
  limit?: number,
  step?: string,
): Promise<ExecutionLog[]> {
  if (step) {
    return storage.getLogsByStep(step, limit);
  }
  return storage.getExecutionLogs(limit);
}
