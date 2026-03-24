import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

type TierRow = { membership_tier: string };
type TagRow = { tag: string };

function calculateTierBreakdown(
  data: TierRow[] | null
): Record<string, number> {
  if (!data) return {};
  const counts: Record<string, number> = {};
  for (const row of data) {
    const tier = row.membership_tier ?? 'unknown';
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  return counts;
}

function calculateTopTags(
  data: TagRow[] | null,
  limit = 10
): { tag: string; count: number }[] {
  if (!data) return [];
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.tag] = (counts[row.tag] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function GET() {
  try {
    const db = getAdminClient();

    // Get multiple stats in parallel
    const [
      totalCustomers,
      newCustomersThisMonth,
      tierBreakdown,
      activeCustomers, // had actions in last 30 days
      topTags,
      segmentCount,
    ] = await Promise.all([
      // total customers (not blocked)
      db
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .is('blocked_at', null),
      // new customers this month
      db
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .gte(
          'created_at',
          new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ).toISOString()
        ),
      // tier breakdown
      db.from('customers').select('membership_tier').is('blocked_at', null),
      // active in last 30 days
      db
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .gte(
          'last_seen_at',
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        ),
      // top tags
      db.from('customer_tags').select('tag'),
      // segment count
      db.from('segments').select('*', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      totalCustomers: totalCustomers.count ?? 0,
      newCustomersThisMonth: newCustomersThisMonth.count ?? 0,
      activeCustomers: activeCustomers.count ?? 0,
      segmentCount: segmentCount.count ?? 0,
      tierBreakdown: calculateTierBreakdown(
        tierBreakdown.data as TierRow[] | null
      ),
      topTags: calculateTopTags(topTags.data as TagRow[] | null),
    });
  } catch (error) {
    console.error('[crm/stats]', error);
    return NextResponse.json(
      { error: '統計情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
