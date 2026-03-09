// ============================================================================
// src/lib/line/messaging.ts
// LINE Messaging API — Broadcast 配信クライアント
// リトライロジック付き (E-07, E-08, E-09)
// ============================================================================

import type { BroadcastRequest, BroadcastResult, FlexContainer, LineMessage } from '@/types/line';
import { buildFlexMessage } from './templates';
import { config } from './config';
import { sleep } from './retry';

// ─── カスタムエラー ──────────────────────────────────────────────────────────

export class LineApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly isAuthError: boolean = false,
  ) {
    super(message);
    this.name = 'LineApiError';
  }
}

// ─── 送信処理 (リトライ付き) ─────────────────────────────────────────────────

async function sendBroadcast(messages: LineMessage[]): Promise<void> {
  const doSend = async (): Promise<void> => {
    const res = await fetch(config.line.broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.line.channelAccessToken}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown');

      // E-07: 認証エラー (401) — 即座にthrow、リトライしない
      if (res.status === 401) {
        throw new LineApiError(
          `LINE API認証エラー: トークンが無効または失効しています。LINE Developers ConsoleでChannel Access Tokenを再発行してください。`,
          401,
          true,
        );
      }

      // E-08: レート制限 (429) — 60秒待機後1回リトライ
      if (res.status === 429) {
        throw new LineApiError(`LINE API rate limit (429): ${body}`, 429);
      }

      // E-09: その他のエラー
      throw new LineApiError(`LINE API error ${res.status}: ${body}`, res.status);
    }
  };

  try {
    await doSend();
  } catch (error) {
    if (!(error instanceof LineApiError)) throw error;

    // E-07: 認証エラーはリトライしない
    if (error.isAuthError) throw error;

    // E-08: 429 は60秒待ってリトライ
    if (error.status === 429) {
      console.log('[messaging] Rate limited (429), waiting 60 seconds before retry...');
      await sleep(config.retry.lineRateLimit.delayMs);
      await doSend();
      return;
    }

    // E-09: 5xx は5秒後に1回リトライ、4xx はリトライしない
    if (error.status >= 500) {
      console.log(`[messaging] Server error (${error.status}), retrying in 5 seconds...`);
      await sleep(config.retry.lineDefault.delayMs);
      await doSend();
      return;
    }

    // 4xx (429以外) はリトライしない
    throw error;
  }
}

// ─── Push送信 (テスト配信用) ─────────────────────────────────────────────────

async function sendPush(to: string, messages: LineMessage[]): Promise<void> {
  const doSend = async (): Promise<void> => {
    const res = await fetch(config.line.pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.line.channelAccessToken}`,
      },
      body: JSON.stringify({ to, messages }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown');
      if (res.status === 401) {
        throw new LineApiError(
          `LINE API認証エラー: トークンが無効または失効しています。`,
          401,
          true,
        );
      }
      if (res.status === 429) {
        throw new LineApiError(`LINE API rate limit (429): ${body}`, 429);
      }
      throw new LineApiError(`LINE API error ${res.status}: ${body}`, res.status);
    }
  };

  try {
    await doSend();
  } catch (error) {
    if (!(error instanceof LineApiError)) throw error;
    if (error.isAuthError) throw error;
    if (error.status === 429) {
      console.log('[messaging] Rate limited (429), waiting 60 seconds before retry...');
      await sleep(config.retry.lineRateLimit.delayMs);
      await doSend();
      return;
    }
    if (error.status >= 500) {
      console.log(`[messaging] Server error (${error.status}), retrying in 5 seconds...`);
      await sleep(config.retry.lineDefault.delayMs);
      await doSend();
      return;
    }
    throw error;
  }
}

// ─── 公開API ─────────────────────────────────────────────────────────────────

export async function broadcastArticle(req: BroadcastRequest): Promise<BroadcastResult> {
  try {
    const flex: FlexContainer = buildFlexMessage(req);
    await sendBroadcast([
      {
        type: 'flex',
        altText: `${req.summaryTitle}\n\n${req.summaryText}\n\n${req.articleUrl}`,
        contents: flex,
      },
    ]);
    return { success: true, sentAt: new Date().toISOString() };
  } catch (error) {
    return {
      success: false,
      sentAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * テスト配信 — 管理者のみにPush送信
 */
export async function testBroadcastArticle(req: BroadcastRequest): Promise<BroadcastResult> {
  const adminUserId = config.line.adminUserId;
  if (!adminUserId) {
    return {
      success: false,
      sentAt: new Date().toISOString(),
      error: 'ADMIN_LINE_USER_ID が設定されていません。.env に追加してください。',
    };
  }

  try {
    const flex: FlexContainer = buildFlexMessage(req);
    await sendPush(adminUserId, [
      {
        type: 'flex',
        altText: `【テスト配信】${req.summaryTitle}\n\n${req.summaryText}\n\n${req.articleUrl}`,
        contents: flex,
      },
    ]);
    return { success: true, sentAt: new Date().toISOString() };
  } catch (error) {
    return {
      success: false,
      sentAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
