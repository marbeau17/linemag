// ============================================================================
// src/lib/line/notifier.ts
// 管理者通知 — LINE Push Message で重要エラーを通知
// ============================================================================

import { config } from './config';

export interface NotificationPayload {
  level: 'critical' | 'high' | 'medium';
  title: string;
  message: string;
  errorCode?: string;
  timestamp: string;
}

const LEVEL_EMOJI: Record<string, string> = {
  critical: '🚨',
  high: '⚠️',
  medium: 'ℹ️',
};

/**
 * 管理者にLINE Push通知を送信する。
 * ADMIN_LINE_USER_ID が未設定の場合はログのみ出力。
 */
export async function notifyAdmin(payload: NotificationPayload): Promise<void> {
  const adminId = config.line.adminUserId;

  const logPrefix = `[notifier:${payload.level}]`;
  console.log(logPrefix, payload.title, payload.message);

  if (!adminId) {
    console.warn('[notifier] ADMIN_LINE_USER_ID not set — skipping LINE notification');
    return;
  }

  const emoji = LEVEL_EMOJI[payload.level] || '';
  const text = [
    `${emoji} LineMag ${payload.level.toUpperCase()} Alert`,
    '',
    `■ ${payload.title}`,
    payload.message,
    '',
    payload.errorCode ? `エラーコード: ${payload.errorCode}` : '',
    `発生日時: ${payload.timestamp}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await fetch(config.line.pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.line.channelAccessToken}`,
      },
      body: JSON.stringify({
        to: adminId,
        messages: [{ type: 'text', text }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown');
      console.error('[notifier] Push notification failed:', res.status, body);
    } else {
      console.log('[notifier] Admin notification sent successfully');
    }
  } catch (error) {
    console.error('[notifier] Failed to send notification:', error);
  }
}

/**
 * エラーコードに基づいて管理者通知を送信
 */
export async function notifyOnError(
  errorCode: string,
  detail: string,
): Promise<void> {
  const errorConfigs: Record<string, { level: NotificationPayload['level']; title: string }> = {
    'E-02': { level: 'high', title: 'HTMLパースエラー — ブログ構造変更の可能性' },
    'E-06': { level: 'medium', title: 'セーフティフィルタブロック' },
    'E-07': { level: 'critical', title: 'LINE認証エラー — トークン失効の可能性' },
    'CONSECUTIVE': { level: 'high', title: '3回連続エラー — システム異常の可能性' },
  };

  const cfg = errorConfigs[errorCode];
  if (!cfg) return;

  await notifyAdmin({
    level: cfg.level,
    title: cfg.title,
    message: detail,
    errorCode,
    timestamp: new Date().toISOString(),
  });
}
