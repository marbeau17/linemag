// ============================================================================
// src/lib/line/messaging.ts
// LINE Messaging API — Broadcast 配信クライアント
// ============================================================================

import type { BroadcastRequest, BroadcastResult, FlexContainer, LineMessage } from '@/types/line';
import { buildFlexMessage } from './templates';

const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';

function getToken(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  return t;
}

async function sendBroadcast(messages: LineMessage[]): Promise<void> {
  const res = await fetch(LINE_BROADCAST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown');
    throw new Error(`LINE API error ${res.status}: ${body}`);
  }
}

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
