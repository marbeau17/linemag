import { NextResponse } from 'next/server';
import { fetchFollowersWithProfiles } from '@/lib/line/followers';

export async function GET() {
  try {
    const followers = await fetchFollowersWithProfiles();
    return NextResponse.json({
      followers,
      count: followers.length,
    });
  } catch (error) {
    console.error('[followers]', error);
    const message = error instanceof Error ? error.message : 'フォロワー一覧の取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
