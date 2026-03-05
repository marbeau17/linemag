import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { ScheduleConfig, TemplateId } from '@/types/line';

const FILE = path.join(process.cwd(), 'data', 'line-schedule.json');

const DEFAULTS: ScheduleConfig = {
  enabled: false,
  times: ['09:00', '18:00'],
  templateId: 'daily-column' as TemplateId,
  maxArticlesPerRun: 3,
};

async function read(): Promise<ScheduleConfig> {
  try { return JSON.parse(await fs.readFile(FILE, 'utf-8')); }
  catch { return { ...DEFAULTS }; }
}

async function write(c: ScheduleConfig) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(c, null, 2), 'utf-8');
}

export async function GET() {
  return NextResponse.json(await read());
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const cur = await read();
    const updated: ScheduleConfig = {
      enabled: body.enabled ?? cur.enabled,
      times: Array.isArray(body.times) ? body.times : cur.times,
      templateId: body.templateId ?? cur.templateId,
      maxArticlesPerRun: body.maxArticlesPerRun ?? cur.maxArticlesPerRun,
    };
    await write(updated);
    return NextResponse.json({ success: true, schedule: updated });
  } catch (error) {
    console.error('[schedule]', error);
    return NextResponse.json({ error: '設定の更新に失敗しました' }, { status: 500 });
  }
}
