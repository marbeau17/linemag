import { NextRequest, NextResponse } from 'next/server';
import { upsertCustomerByLineUserId, getCustomers } from '@/lib/crm/customers';
import { trackAction } from '@/lib/crm/actions';

// ============================================================================
// LINE Webhook — Supabase-backed customer tracking
// LINE Developers Console の Webhook URL にこのエンドポイントを設定:
//   https://linemag.vercel.app/api/line/webhook
// ============================================================================

interface WebhookEvent {
  type: string;
  source?: {
    type: string;
    userId?: string;
  };
  message?: {
    type: string;
    text?: string;
  };
  timestamp: number;
  replyToken?: string;
}

interface WebhookBody {
  events: WebhookEvent[];
}

// POST — LINE Webhookイベント受信
export async function POST(request: NextRequest) {
  try {
    const body: WebhookBody = await request.json();

    if (!body.events || body.events.length === 0) {
      // Webhook verification (LINE sends empty events array)
      return NextResponse.json({ status: 'ok' });
    }

    const now = new Date().toISOString();

    for (const event of body.events) {
      const userId = event.source?.userId;
      if (!userId) continue;

      try {
        switch (event.type) {
          case 'follow': {
            const customer = await upsertCustomerByLineUserId(userId, {
              firstSeenAt: now,
              lastSeenAt: now,
              blockedAt: null as unknown as string,
            });
            await trackAction({
              customerId: customer.id,
              actionType: 'follow',
              source: 'line_webhook',
            });
            console.log(`[webhook] follow: ${userId}`);
            break;
          }

          case 'unfollow': {
            const customer = await upsertCustomerByLineUserId(userId, {
              blockedAt: now,
              lastSeenAt: now,
            });
            await trackAction({
              customerId: customer.id,
              actionType: 'unfollow',
              source: 'line_webhook',
            });
            console.log(`[webhook] unfollow: ${userId}`);
            break;
          }

          case 'message': {
            // Fetch existing customer first so we can increment message_count
            const customer = await upsertCustomerByLineUserId(userId, {
              lastSeenAt: now,
            });

            // Increment message_count via a second upsert
            await upsertCustomerByLineUserId(userId, {
              messageCount: (customer.messageCount ?? 0) + 1,
              lastSeenAt: now,
            });

            await trackAction({
              customerId: customer.id,
              actionType: 'message_received',
              actionDetail: {
                messageType: event.message?.type,
                text: event.message?.text,
              },
              source: 'line_webhook',
            });
            console.log(`[webhook] message: ${userId}`);
            break;
          }

          default: {
            // For any other event type, still upsert & track
            const customer = await upsertCustomerByLineUserId(userId, {
              lastSeenAt: now,
            });
            await trackAction({
              customerId: customer.id,
              actionType: 'message_received',
              actionDetail: { eventType: event.type },
              source: 'line_webhook',
            });
            console.log(`[webhook] ${event.type}: ${userId}`);
            break;
          }
        }
      } catch (eventError) {
        // Log but don't fail the whole webhook — LINE requires 200 response
        console.error(`[webhook] Error processing event for ${userId}:`, eventError);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[webhook]', error);
    // LINE requires 200 even on errors to avoid retries
    return NextResponse.json({ status: 'ok' });
  }
}

// GET — 記録済み顧客一覧を取得（最新100件、last_seen_at降順）
export async function GET() {
  try {
    const result = await getCustomers({
      perPage: 100,
      sortBy: 'last_seen_at',
      sortOrder: 'desc',
    });
    return NextResponse.json({
      customers: result.customers,
      count: result.total,
    });
  } catch (error) {
    console.error('[webhook:get]', error);
    return NextResponse.json(
      { error: 'ユーザー一覧の取得に失敗しました' },
      { status: 500 },
    );
  }
}
