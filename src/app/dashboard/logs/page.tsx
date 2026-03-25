'use client';

import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
  id: string;
  executedAt: string;
  step: string;
  result: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

const STEP_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'CRON', label: 'CRON' },
  { value: 'SCRAPE', label: 'SCRAPE' },
  { value: 'SUMMARIZE', label: 'SUMMARIZE' },
  { value: 'BROADCAST', label: 'BROADCAST' },
];

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  ERROR: 'bg-red-100 text-red-700',
  SKIP: 'bg-slate-100 text-slate-500',
};

const STEP_COLORS: Record<string, string> = {
  CRON: 'bg-blue-100 text-blue-700',
  SCRAPE: 'bg-purple-100 text-purple-700',
  SUMMARIZE: 'bg-amber-100 text-amber-700',
  BROADCAST: 'bg-green-100 text-green-700',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepFilter, setStepFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (stepFilter) params.set('step', stepFilter);
      const res = await fetch(`/api/line/logs?${params}`);
      if (!res.ok) {
        let errorMsg = 'ログの取得に失敗しました';
        try {
          const errData = await res.json();
          if (errData?.error) errorMsg = errData.error;
        } catch {
          // Response was not JSON; use default message
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [stepFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">実行ログ</h1>
          <p className="text-sm text-slate-400 mt-1">システムの実行履歴とエラーログ</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {loading ? '読込中...' : '更新'}
        </button>
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-2">
        {STEP_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStepFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              stepFilter === opt.value
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">日時</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">ステップ</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">結果</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">詳細</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                  <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-300" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  読み込み中...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                  実行ログはまだありません。
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">{formatDate(log.executedAt)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STEP_COLORS[log.step] || 'bg-slate-100 text-slate-500'}`}>
                      {log.step}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_COLORS[log.result] || 'bg-slate-100 text-slate-500'}`}>
                      {log.result}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 max-w-md truncate" title={log.detail}>
                    {log.detail}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
