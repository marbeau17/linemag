'use client';

import { useState, useEffect } from 'react';
import type { ScheduleConfig, TemplateId } from '@/types/line';
import { TEMPLATE_DEFINITIONS } from '@/lib/line/templates';

async function safeJsonParse(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function SchedulePage() {
  const [config, setConfig] = useState<ScheduleConfig>({
    enabled: false, times: ['09:00', '18:00'], templateId: 'daily-column', maxArticlesPerRun: 3,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/line/schedule');
        if (!r.ok) throw new Error('スケジュール設定の取得に失敗しました');
        const d = await safeJsonParse(r);
        if (d && typeof d === 'object') {
          setConfig(d as unknown as ScheduleConfig);
        }
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : 'スケジュール設定の取得に失敗しました' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/line/schedule', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const d = await safeJsonParse(r);
      if (!r.ok) throw new Error((d.error as string) || '設定の保存に失敗しました');
      if (d.schedule) setConfig(d.schedule as unknown as ScheduleConfig);
      setMsg({ ok: true, text: '設定を保存しました' });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'エラー' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">スケジュール配信</h1>
        <p className="text-sm text-slate-400 mt-1">毎日の自動配信時刻とテンプレートを設定</p>
      </div>

      {loading && (
        <div className="px-4 py-3 rounded-lg text-sm bg-slate-50 text-slate-500 border border-slate-200">
          設定を読み込み中...
        </div>
      )}

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          msg.ok
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>{msg.text}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">定期配信</h2>
            <p className="text-xs text-slate-400 mt-0.5">Vercel Cron で自動実行されます</p>
          </div>
          <button onClick={() => setConfig(p => ({ ...p, enabled: !p.enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-slate-300'}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className={`p-5 space-y-5 ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">配信時刻（JST）</label>
            <div className="space-y-2">
              {config.times.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="time" value={t}
                    onChange={e => setConfig(p => ({ ...p, times: p.times.map((x, j) => j === i ? e.target.value : x) }))}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                  {config.times.length > 1 && (
                    <button onClick={() => setConfig(p => ({ ...p, times: p.times.filter((_, j) => j !== i) }))}
                      className="p-1.5 text-slate-400 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {config.times.length < 4 && (
              <button onClick={() => setConfig(p => ({ ...p, times: [...p.times, '12:00'] }))}
                className="mt-2 text-xs text-green-600 hover:text-green-700 font-medium">+ 時刻を追加</button>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">使用テンプレート</label>
            <select value={config.templateId}
              onChange={e => setConfig(p => ({ ...p, templateId: e.target.value as TemplateId }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
              {TEMPLATE_DEFINITIONS.map(t => (
                <option key={t.id} value={t.id}>{t.name} — {t.recommendedFor}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">1回あたりの最大記事数</label>
            <input type="number" min={1} max={5} value={config.maxArticlesPerRun}
              onChange={e => setConfig(p => ({ ...p, maxArticlesPerRun: parseInt(e.target.value) || 1 }))}
              className="w-20 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
