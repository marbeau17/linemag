// ============================================================================
// src/lib/line/followers.ts
// LINE Messaging API — フォロワー取得・プロフィール取得
// ============================================================================

import { config } from './config';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface LineUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

// ─── フォロワーID一覧取得 ────────────────────────────────────────────────────

export async function fetchAllFollowerIds(): Promise<string[]> {
  const allIds: string[] = [];
  let start: string | undefined;

  // ページネーションで全フォロワーIDを取得
  do {
    const url = new URL('https://api.line.me/v2/bot/followers/ids');
    url.searchParams.set('limit', '1000');
    if (start) url.searchParams.set('start', start);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.line.channelAccessToken}`,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown');
      if (res.status === 403) {
        throw new Error(
          'フォロワー一覧の取得にはLINE公式アカウント（認証済み）が必要です。未認証アカウントの場合、手動でUser IDを入力してください。'
        );
      }
      if (res.status === 401) {
        throw new Error('LINE API認証エラー: Channel Access Tokenを確認してください。');
      }
      throw new Error(`LINE API error ${res.status}: ${body.substring(0, 200)}`);
    }

    const data = await res.json();
    allIds.push(...(data.userIds || []));
    start = data.next;
  } while (start);

  return allIds;
}

// ─── プロフィール取得 ────────────────────────────────────────────────────────

export async function fetchUserProfile(userId: string): Promise<LineUserProfile> {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: {
      Authorization: `Bearer ${config.line.channelAccessToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown');
    throw new Error(`Profile fetch failed for ${userId}: ${res.status} ${body.substring(0, 200)}`);
  }

  const data = await res.json();
  return {
    userId: data.userId,
    displayName: data.displayName,
    pictureUrl: data.pictureUrl || undefined,
    statusMessage: data.statusMessage || undefined,
  };
}

// ─── フォロワー一覧 + プロフィール取得 ───────────────────────────────────────

export async function fetchFollowersWithProfiles(): Promise<LineUserProfile[]> {
  const ids = await fetchAllFollowerIds();

  // 並列取得（最大20件ずつバッチ処理）
  const BATCH_SIZE = 20;
  const profiles: LineUserProfile[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => fetchUserProfile(id))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        profiles.push(result.value);
      } else {
        console.warn('[followers] Profile fetch failed:', result.reason);
      }
    }
  }

  // displayName でソート
  profiles.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));

  return profiles;
}
