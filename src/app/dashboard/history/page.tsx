'use client';

import { useState, useEffect, useCallback } from 'react';

interface HistoryRecord {
  url: string;
  title: string;
  sentAt: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  templateId?: string;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/line/history?limit=50');
      if (!res.ok) throw new Error('履歴の取得に失敗しました');
      const data = await res.json();
      setRecords(data.history || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const templateNames: Record<string, string> = {
    'daily-column': 'デイリーコラム',
    'news-card': 'ニュースカード',
    'visual-magazine': 'ビジュアルマガジン',
    'minimal-text': 'ミニマルテキスト',
    'premium-card': 'プレミアムカード',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">配信履歴</h1>
          <p className="text-sm text-slate-400 mt-1">過去のLINE配信の記録</p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {loading ? '読込中...' : '更新'}
        </button>
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
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">日時</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">記事タイトル</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">テンプレート</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                  <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-300" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  読み込み中...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                  配信履歴はまだありません。マニュアル配信またはスケジュール配信を実行すると、ここに記録されます。
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr key={`${r.url}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(r.sentAt)}</td>
                  <td className="px-5 py-3">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-700 hover:text-green-600 transition-colors">
                      {r.title}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{templateNames[r.templateId || ''] || r.templateId || '-'}</td>
                  <td className="px-5 py-3">
                    {r.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        成功
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700" title={r.error}>
                        失敗
                      </span>
                    )}
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
