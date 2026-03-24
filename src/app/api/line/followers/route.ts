import { NextResponse } from 'next/server';
import { fetchFollowersWithProfiles } from '@/lib/line/followers';
import { upsertCustomerByLineUserId } from '@/lib/crm/customers';

export async function GET() {
  try {
    const followers = await fetchFollowersWithProfiles();

    // Sync follower profiles to Supabase customers table in the background
    // (fire-and-forget — don't block the response)
    Promise.allSettled(
      followers.map((f) =>
        upsertCustomerByLineUserId(f.userId, {
          displayName: f.displayName,
          pictureUrl: f.pictureUrl ?? null,
          statusMessage: f.statusMessage ?? null,
        })
      )
    ).catch((err) => {
      console.error('[followers] Supabase sync error:', err);
    });

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
