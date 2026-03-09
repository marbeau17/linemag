import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/line/storage';
import type { ScheduleConfig } from '@/types/line';

export async function GET() {
  return NextResponse.json(await storage.getSchedule());
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const cur = await storage.getSchedule();
    const updated: ScheduleConfig = {
      enabled: body.enabled ?? cur.enabled,
      times: Array.isArray(body.times) ? body.times : cur.times,
      templateId: body.templateId ?? cur.templateId,
      maxArticlesPerRun: body.maxArticlesPerRun ?? cur.maxArticlesPerRun,
    };
    await storage.saveSchedule(updated);
    return NextResponse.json({ success: true, schedule: updated });
  } catch (error) {
    console.error('[schedule]', error);
    return NextResponse.json({ error: '設定の更新に失敗しました' }, { status: 500 });
  }
}
