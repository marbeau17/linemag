'use client';

import { useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportType = 'delivery' | 'customer' | 'coupon' | 'reservation' | 'summary';
type ExportFormat = 'json' | 'csv';

interface ReportSummary {
  totalRecords: number;
  [key: string]: string | number;
}

interface ReportData {
  summary: ReportSummary;
  columns: string[];
  rows: Record<string, string | number>[];
}

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'delivery', label: '配信レポート' },
  { value: 'customer', label: '顧客レポート' },
  { value: 'coupon', label: 'クーポンレポート' },
  { value: 'reservation', label: '予約レポート' },
  { value: 'summary', label: 'サマリーレポート' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function downloadCsv(csvText: string, filename: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('delivery');
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(todayStr());
  const [format, setFormat] = useState<ExportFormat>('json');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);

  // ── Fetch report (JSON preview) ──────────────────────────────────────────

  const generateReport = useCallback(
    async (type?: ReportType, from?: string, to?: string) => {
      const t = type ?? reportType;
      const f = from ?? fromDate;
      const tt = to ?? toDate;

      setLoading(true);
      setError(null);
      setReport(null);

      try {
        const params = new URLSearchParams({ type: t, from: f, to: tt, format: 'json' });
        const res = await fetch(`/api/analytics/reports?${params}`);
        if (!res.ok) throw new Error('レポートの取得に失敗しました');
        const data: ReportData = await res.json();
        setReport(data);
        setReportType(t);
        setFromDate(f);
        setToDate(tt);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    },
    [reportType, fromDate, toDate],
  );

  // ── Download CSV ─────────────────────────────────────────────────────────

  const handleCsvDownload = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: reportType, from: fromDate, to: toDate, format: 'csv' });
      const res = await fetch(`/api/analytics/reports?${params}`);
      if (!res.ok) throw new Error('CSVの取得に失敗しました');
      const csvText = await res.text();
      const label = REPORT_TYPES.find((r) => r.value === reportType)?.label ?? 'report';
      downloadCsv(csvText, `${label}_${fromDate}_${toDate}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSVダウンロードに失敗しました');
    }
  }, [reportType, fromDate, toDate]);

  // ── Quick reports ────────────────────────────────────────────────────────

  const quickReports: { title: string; description: string; type: ReportType; from: string; to: string }[] = [
    {
      title: '今月のサマリー',
      description: '今月1日から本日までのサマリーレポート',
      type: 'summary',
      from: firstOfMonth(),
      to: todayStr(),
    },
    {
      title: '直近7日の配信',
      description: '過去7日間の配信パフォーマンス',
      type: 'delivery',
      from: daysAgo(7),
      to: todayStr(),
    },
    {
      title: 'アクティブ顧客一覧',
      description: '過去30日にアクションのあった顧客',
      type: 'customer',
      from: daysAgo(30),
      to: todayStr(),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900">レポート</h1>

      {/* Report Generator Card */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-800">レポート生成</h2>

        {/* Report type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">レポートタイプ</label>
          <div className="flex flex-wrap gap-4">
            {REPORT_TYPES.map((rt) => (
              <label key={rt.value} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="reportType"
                  value={rt.value}
                  checked={reportType === rt.value}
                  onChange={() => setReportType(rt.value)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700">{rt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">フォーマット</label>
          <div className="flex gap-6">
            {(['json', 'csv'] as ExportFormat[]).map((f) => (
              <label key={f} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700 uppercase">{f}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={() => generateReport()}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md px-5 py-2.5 transition-colors"
        >
          {loading && <Spinner />}
          レポート生成
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Preview Section */}
      {report && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">プレビュー</h2>
            <button
              onClick={handleCsvDownload}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md px-4 py-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
              </svg>
              CSVダウンロード
            </button>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(report.summary).map(([key, value]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{key}</p>
                <p className="text-xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
              </div>
            ))}
          </div>

          {/* Data table */}
          {report.columns.length > 0 && report.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {report.columns.map((col) => (
                      <th key={col} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {report.columns.map((col) => (
                        <td key={col} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                          {row[col] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.rows.length > 20 && (
                <p className="text-xs text-gray-500 mt-2 text-right">
                  先頭20件を表示中（全{report.rows.length.toLocaleString()}件）
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">クイックレポート</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickReports.map((qr) => (
            <button
              key={qr.title}
              onClick={() => generateReport(qr.type, qr.from, qr.to)}
              disabled={loading}
              className="text-left bg-white rounded-lg shadow p-5 hover:shadow-md hover:border-blue-400 border border-gray-200 transition-all disabled:opacity-50"
            >
              <h3 className="font-semibold text-gray-900 mb-1">{qr.title}</h3>
              <p className="text-xs text-gray-500">{qr.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
