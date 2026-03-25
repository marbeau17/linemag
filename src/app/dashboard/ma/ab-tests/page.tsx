'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Variant {
  name: string;
  config: Record<string, unknown>;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
}

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed' | 'stopped';
  test_type: 'template' | 'content' | 'send_time' | 'subject';
  variant_a: Variant;
  variant_b: Variant;
  winner: 'A' | 'B' | null;
  is_significant: boolean;
  target_segment_id: string | null;
  sample_size: number;
  metric: 'open_rate' | 'click_rate' | 'conversion_rate';
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface Segment {
  id: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatDate = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const STATUS_MAP: Record<ABTest['status'], { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-slate-100 text-slate-600' },
  running: { label: '実行中', className: 'bg-blue-100 text-blue-700' },
  completed: { label: '完了', className: 'bg-green-100 text-green-700' },
  stopped: { label: '中止', className: 'bg-red-100 text-red-700' },
};

const TYPE_MAP: Record<ABTest['test_type'], string> = {
  template: 'テンプレート比較',
  content: 'コンテンツ比較',
  send_time: '送信時刻比較',
  subject: '件名比較',
};

const METRIC_MAP: Record<ABTest['metric'], string> = {
  open_rate: '開封率',
  click_rate: 'クリック率',
  conversion_rate: 'コンバージョン率',
};

const rate = (num: number, den: number) => (den > 0 ? ((num / den) * 100).toFixed(1) : '0.0');

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ABTestsPage() {
  // ----- data state -----
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // ----- create modal -----
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<ABTest['test_type']>('template');
  const [formVariantA, setFormVariantA] = useState('{}');
  const [formVariantB, setFormVariantB] = useState('{}');
  const [formSegment, setFormSegment] = useState('');
  const [formSampleSize, setFormSampleSize] = useState(1000);
  const [formMetric, setFormMetric] = useState<ABTest['metric']>('open_rate');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

  // ----- results view -----
  const [viewingTest, setViewingTest] = useState<ABTest | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Fetch tests                                                      */
  /* ---------------------------------------------------------------- */

  const fetchTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ma/ab-tests', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'A/Bテスト一覧の取得に失敗しました');
      }
      const data = await res.json().catch(() => null);
      if (data == null) {
        setTests([]);
      } else {
        const list = Array.isArray(data) ? data : Array.isArray(data.tests) ? data.tests : [];
        setTests(list);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  /* ---------------------------------------------------------------- */
  /*  Fetch segments (for modal)                                       */
  /* ---------------------------------------------------------------- */

  const fetchSegments = async () => {
    setSegmentsLoading(true);
    try {
      const res = await fetch('/api/crm/segments', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data == null) return;
      const list = Array.isArray(data) ? data : Array.isArray(data.segments) ? data.segments : [];
      setSegments(list);
    } catch {
      // silently fail, user can still type
    } finally {
      setSegmentsLoading(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Create modal                                                     */
  /* ---------------------------------------------------------------- */

  const openCreate = () => {
    setFormName('');
    setFormDesc('');
    setFormType('template');
    setFormVariantA('{}');
    setFormVariantB('{}');
    setFormSegment('');
    setFormSampleSize(1000);
    setFormMetric('open_rate');
    setModalOpen(true);
    fetchSegments();
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      let parsedA: Record<string, unknown>, parsedB: Record<string, unknown>;
      try {
        parsedA = JSON.parse(formVariantA);
      } catch {
        throw new Error('バリアントAの設定JSONが不正です');
      }
      try {
        parsedB = JSON.parse(formVariantB);
      } catch {
        throw new Error('バリアントBの設定JSONが不正です');
      }

      const body = {
        name: formName.trim(),
        description: formDesc.trim(),
        test_type: formType,
        variant_a: { name: 'A', config: parsedA },
        variant_b: { name: 'B', config: parsedB },
        target_segment_id: formSegment || null,
        sample_size: formSampleSize,
        metric: formMetric,
      };

      const res = await fetch('/api/ma/ab-tests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '作成に失敗しました');
      }

      setModalOpen(false);
      setMsg('A/Bテストを作成しました');
      await fetchTests();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Actions: start / stop                                            */
  /* ---------------------------------------------------------------- */

  const handleAction = async (testId: string, action: 'start' | 'stop') => {
    setMsg(null);
    try {
      const res = await fetch(`/api/ma/ab-tests/${testId}/${action}`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '操作に失敗しました');
      }
      setMsg(action === 'start' ? 'テストを開始しました' : 'テストを中止しました');
      await fetchTests();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'エラー');
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render helpers                                                   */
  /* ---------------------------------------------------------------- */

  const Spinner = () => (
    <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-300" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 pb-3">
        <Link href="/dashboard/ma" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100">
          シナリオ
        </Link>
        <Link href="/dashboard/ma/ab-tests" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-700">
          A/Bテスト
        </Link>
      </div>

      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">A/Bテスト</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? '読み込み中...' : `${tests.length}件のテスト`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新規テスト作成
        </button>
      </div>

      {/* ---------- Flash messages ---------- */}
      {msg && (
        <div className="px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200 flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-green-500 hover:text-green-700 ml-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}

      {/* ---------- Results detail panel ---------- */}
      {viewingTest && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">テスト結果: {viewingTest.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{viewingTest.description || '説明なし'}</p>
            </div>
            <div className="flex items-center gap-2">
              {viewingTest.is_significant && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  統計的有意
                </span>
              )}
              <button
                onClick={() => setViewingTest(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Variant A */}
              {[
                { label: 'A', variant: viewingTest.variant_a, isWinner: viewingTest.winner === 'A' },
                { label: 'B', variant: viewingTest.variant_b, isWinner: viewingTest.winner === 'B' },
              ].map(({ label, variant: rawVariant, isWinner }) => {
                const variant = rawVariant ?? { name: label, config: {}, delivered: 0, opened: 0, clicked: 0, converted: 0 };
                const openRate = parseFloat(rate(variant.opened ?? 0, variant.delivered ?? 0));
                const clickRate = parseFloat(rate(variant.clicked ?? 0, variant.delivered ?? 0));
                const cvRate = parseFloat(rate(variant.converted ?? 0, variant.delivered ?? 0));

                return (
                  <div
                    key={label}
                    className={`rounded-xl border p-5 space-y-4 ${
                      isWinner ? 'border-green-300 bg-green-50/30' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">
                        バリアント {label}
                        {variant.name && variant.name !== label && (
                          <span className="ml-2 text-xs font-normal text-slate-400">({variant.name})</span>
                        )}
                      </h3>
                      {isWinner && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          勝者
                        </span>
                      )}
                    </div>

                    {/* Counts */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: '配信数', value: variant.delivered ?? 0 },
                        { label: '開封数', value: variant.opened ?? 0 },
                        { label: 'クリック数', value: variant.clicked ?? 0 },
                        { label: 'CV数', value: variant.converted ?? 0 },
                      ].map((m) => (
                        <div key={m.label}>
                          <span className="block text-xs font-semibold text-slate-500">{m.label}</span>
                          <span className="block text-lg font-bold text-slate-800 tabular-nums">{m.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* Rate bars */}
                    <div className="space-y-3">
                      {[
                        { label: '開封率', value: openRate, color: 'bg-blue-500' },
                        { label: 'クリック率', value: clickRate, color: 'bg-amber-500' },
                        { label: 'CV率', value: cvRate, color: 'bg-green-500' },
                      ].map((m) => (
                        <div key={m.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-600">{m.label}</span>
                            <span className="text-xs font-bold text-slate-800 tabular-nums">{m.value}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${m.color}`}
                              style={{ width: `${Math.min(m.value, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Test list as cards ---------- */}
      {loading && tests.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          <Spinner />
          読み込み中...
        </div>
      ) : tests.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          A/Bテストはまだ作成されていません。「新規テスト作成」ボタンから始めましょう。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tests.map((test) => {
            const status = STATUS_MAP[test.status];
            const aOpenRate = rate(test.variant_a?.opened ?? 0, test.variant_a?.delivered ?? 0);
            const bOpenRate = rate(test.variant_b?.opened ?? 0, test.variant_b?.delivered ?? 0);

            return (
              <div
                key={test.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{test.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        {TYPE_MAP[test.test_type]}
                      </span>
                    </div>
                    {test.description && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{test.description}</p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span>サンプルサイズ: <strong className="text-slate-700">{test.sample_size.toLocaleString()}</strong></span>
                      <span>最適化指標: <strong className="text-slate-700">{METRIC_MAP[test.metric]}</strong></span>
                      {test.started_at && <span>開始: {formatDate(test.started_at)}</span>}
                      {test.ended_at && <span>終了: {formatDate(test.ended_at)}</span>}
                    </div>

                    {/* Results summary for completed */}
                    {(test.status === 'completed' || test.status === 'stopped') && (
                      <div className="flex items-center gap-4 mt-3">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          test.winner === 'A' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-slate-50 text-slate-600'
                        }`}>
                          A: {aOpenRate}%
                          {test.winner === 'A' && (
                            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          )}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          test.winner === 'B' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-slate-50 text-slate-600'
                        }`}>
                          B: {bOpenRate}%
                          {test.winner === 'B' && (
                            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          )}
                        </div>
                        {test.is_significant && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            統計的有意
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {test.status === 'draft' && (
                      <button
                        onClick={() => handleAction(test.id, 'start')}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        開始
                      </button>
                    )}
                    {test.status === 'running' && (
                      <button
                        onClick={() => handleAction(test.id, 'stop')}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        中止
                      </button>
                    )}
                    {(test.status === 'completed' || test.status === 'stopped') && (
                      <button
                        onClick={() => setViewingTest(viewingTest?.id === test.id ? null : test)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          viewingTest?.id === test.id
                            ? 'text-green-700 bg-green-100 hover:bg-green-200'
                            : 'text-green-700 bg-green-50 border border-green-200 hover:bg-green-100'
                        }`}
                      >
                        {viewingTest?.id === test.id ? '結果を閉じる' : '結果を見る'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- Create Modal ---------- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">新規A/Bテスト作成</h2>
            </div>

            <div className="p-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  テスト名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例：春キャンペーン テンプレートテスト"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">説明</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="テストの目的や仮説を記述"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                />
              </div>

              {/* Test type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">テストタイプ</label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: 'template', label: 'テンプレート比較' },
                      { value: 'content', label: 'コンテンツ比較' },
                      { value: 'send_time', label: '送信時刻比較' },
                      { value: 'subject', label: '件名比較' },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        formType === opt.value
                          ? 'border-green-400 bg-green-50 text-green-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="testType"
                        value={opt.value}
                        checked={formType === opt.value}
                        onChange={() => setFormType(opt.value)}
                        className="text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Variant configs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">バリアントA 設定（JSON）</label>
                  <textarea
                    value={formVariantA}
                    onChange={(e) => setFormVariantA(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                    placeholder='{ "template_id": "tpl_001" }'
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">バリアントB 設定（JSON）</label>
                  <textarea
                    value={formVariantB}
                    onChange={(e) => setFormVariantB(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                    placeholder='{ "template_id": "tpl_002" }'
                  />
                </div>
              </div>

              {/* Target segment */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ターゲットセグメント</label>
                <select
                  value={formSegment}
                  onChange={(e) => setFormSegment(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white"
                >
                  <option value="">
                    {segmentsLoading ? '読み込み中...' : '-- セグメントを選択 --'}
                  </option>
                  {segments.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sample size */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">サンプルサイズ</label>
                <input
                  type="number"
                  value={formSampleSize}
                  onChange={(e) => setFormSampleSize(Number(e.target.value))}
                  min={10}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
                <p className="mt-1 text-xs text-slate-400">各バリアントに配信される合計数</p>
              </div>

              {/* Metric */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">最適化指標</label>
                <div className="flex gap-4">
                  {(
                    [
                      { value: 'open_rate', label: '開封率' },
                      { value: 'click_rate', label: 'クリック率' },
                      { value: 'conversion_rate', label: 'コンバージョン率' },
                    ] as const
                  ).map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="metric"
                        value={opt.value}
                        checked={formMetric === opt.value}
                        onChange={() => setFormMetric(opt.value)}
                        className="text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '作成中...' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
