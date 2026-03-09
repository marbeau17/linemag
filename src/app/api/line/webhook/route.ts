import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// ============================================================================
// LINE Webhook — メッセージ受信時にUser IDを記録
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

interface StoredUser {
  userId: string;
  firstSeen: string;
  lastSeen: string;
  messageCount: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'webhook-users.json');

async function loadUsers(): Promise<StoredUser[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveUsers(users: StoredUser[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// POST — LINE Webhookイベント受信
export async function POST(request: NextRequest) {
  try {
    const body: WebhookBody = await request.json();

    if (!body.events || body.events.length === 0) {
      // Webhook verification (LINE sends empty events array)
      return NextResponse.json({ status: 'ok' });
    }

    const users = await loadUsers();
    const now = new Date().toISOString();

    for (const event of body.events) {
      const userId = event.source?.userId;
      if (!userId) continue;

      const existing = users.find((u) => u.userId === userId);
      if (existing) {
        existing.lastSeen = now;
        existing.messageCount += 1;
      } else {
        users.push({
          userId,
          firstSeen: now,
          lastSeen: now,
          messageCount: 1,
        });
      }

      console.log(`[webhook] User: ${userId}, event: ${event.type}`);
    }

    await saveUsers(users);
    return NextResponse.json({ status: 'ok', usersCount: users.length });
  } catch (error) {
    console.error('[webhook]', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

// GET — 記録済みUser ID一覧を取得
export async function GET() {
  try {
    const users = await loadUsers();
    return NextResponse.json({ users, count: users.length });
  } catch (error) {
    console.error('[webhook:get]', error);
    return NextResponse.json({ error: 'ユーザー一覧の取得に失敗しました' }, { status: 500 });
  }
}
