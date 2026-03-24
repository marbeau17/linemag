import { NextRequest, NextResponse } from 'next/server';
import { generateReport, reportToCSV, ReportConfig } from '@/lib/analytics/reports';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as ReportConfig['type'];
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const format = searchParams.get('format') ?? 'json';

  if (!type || !from || !to) {
    return NextResponse.json(
      { error: 'type, from, to は必須パラメータです' },
      { status: 400 }
    );
  }

  try {
    const report = await generateReport({ type, dateRange: { from, to }, format: format as ReportConfig['format'] });

    if (format === 'csv') {
      const csv = reportToCSV(report);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="report-${type}-${from}-${to}.csv"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error(`[analytics/reports] GET type=${type}`, error);
    const message =
      error instanceof Error ? error.message : 'レポートの生成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
