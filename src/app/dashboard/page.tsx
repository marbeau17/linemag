'use client';

import { useState, useCallback } from 'react';
import ArticleCard from '@/components/line/ArticleCard';
import TemplateSelector from '@/components/line/TemplateSelector';
import FlexPreview from '@/components/line/FlexPreview';
import { TEMPLATE_DEFINITIONS } from '@/lib/line/templates';
import type { TemplateId } from '@/types/line';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface ArticleListItem {
  url: string;
  title: string;
  thumbnailUrl: string | null;
  category: string | null;
}

interface ArticleDetail {
  url: string;
  title: string;
  catchyTitle: string;
  summaryText: string;
  thumbnailUrl: string | null;
  category: string | null;
}

type Step = 'fetch' | 'select' | 'template' | 'confirm';

// ─── Spinner SVG (reused) ────────────────────────────────────────────────────

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // Steps
  const [step, setStep] = useState<Step>('fetch');

  // Article list (lightweight, from scrape-list)
  const [articleList, setArticleList] = useState<ArticleListItem[]>([]);

  // Detail cache: url -> ArticleDetail
  const [detailLoaded, setDetailLoaded] = useState<Record<string, ArticleDetail>>({});

  // Which articles are currently loading detail
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});

  // Selection
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  // Template
  const [templateId, setTemplateId] = useState<TemplateId>('daily-column');

  // UI state
  const [listLoading, setListLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Step 1: Fetch article list (fast) ──────────────────────────────────────

  const fetchArticleList = useCallback(async () => {
    setListLoading(true);
    setMsg(null);
    try {
      const r = await fetch('/api/line/scrape-list', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const articles: ArticleListItem[] = d.articles || [];
      setArticleList(articles);
      setDetailLoaded({});
      setDetailLoading({});
      setSelectedUrl(null);
      setStep('select');
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '記事一覧の取得に失敗しました' });
    } finally {
      setListLoading(false);
    }
  }, []);

  // ── Step 2: Fetch detail for a single article ─────────────────────────────

  const fetchDetail = useCallback(async (item: ArticleListItem) => {
    // Already loaded or loading
    if (detailLoaded[item.url] || detailLoading[item.url]) return;

    setDetailLoading((prev) => ({ ...prev, [item.url]: true }));
    try {
      const r = await fetch('/api/line/scrape-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: item.url,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl,
          category: item.category,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const detail: ArticleDetail = {
        url: d.url,
        title: d.title,
        catchyTitle: d.catchyTitle,
        summaryText: d.summaryText,
        thumbnailUrl: d.thumbnailUrl,
        category: d.category,
      };
      setDetailLoaded((prev) => ({ ...prev, [item.url]: detail }));
    } catch (e) {
      setMsg({ ok: false, text: `詳細取得失敗: ${e instanceof Error ? e.message : 'エラー'}` });
    } finally {
      setDetailLoading((prev) => ({ ...prev, [item.url]: false }));
    }
  }, [detailLoaded, detailLoading]);

  // ── Select article + auto-fetch detail ─────────────────────────────────────

  const handleSelectArticle = useCallback(
    (item: ArticleListItem) => {
      setSelectedUrl(item.url);
      if (!detailLoaded[item.url] && !detailLoading[item.url]) {
        fetchDetail(item);
      }
    },
    [detailLoaded, detailLoading, fetchDetail],
  );

  // ── Step 4: Send broadcast ─────────────────────────────────────────────────

  const send = useCallback(async () => {
    if (!selectedUrl) return;
    const detail = detailLoaded[selectedUrl];
    if (!detail) return;

    setSending(true);
    setMsg(null);
    try {
      const r = await fetch('/api/line/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleUrl: detail.url,
          articleTitle: detail.title,
          summaryTitle: detail.catchyTitle,
          summaryText: detail.summaryText,
          thumbnailUrl: detail.thumbnailUrl,
          templateId,
          articleCategory: detail.category,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ ok: true, text: 'LINE配信が完了しました！' });
      setStep('fetch');
      setArticleList([]);
      setDetailLoaded({});
      setDetailLoading({});
      setSelectedUrl(null);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '配信に失敗しました' });
    } finally {
      setSending(false);
    }
  }, [selectedUrl, detailLoaded, templateId]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const selectedDetail = selectedUrl ? detailLoaded[selectedUrl] : null;
  const selectedItem = articleList.find((a) => a.url === selectedUrl) ?? null;

  const loadedCount = Object.keys(detailLoaded).length;
  const loadingCount = Object.values(detailLoading).filter(Boolean).length;

  // Can proceed to template step only if selected article has detail loaded
  const canProceedToTemplate = selectedUrl !== null && selectedDetail !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">マニュアル配信</h1>
        <p className="text-sm text-slate-400 mt-1">
          記事一覧取得 → 記事選択・詳細取得 → テンプレート選択 → 確認・配信
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {([
          { id: 'fetch' as Step, l: '1. 記事一覧取得' },
          { id: 'select' as Step, l: '2. 記事選択' },
          { id: 'template' as Step, l: '3. テンプレート' },
          { id: 'confirm' as Step, l: '4. 確認・配信' },
        ]).map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-slate-200" />}
            <span
              className={`px-2.5 py-1 rounded-full font-medium ${
                step === s.id
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s.l}
            </span>
          </div>
        ))}
      </div>

      {/* Message Toast */}
      {msg && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            msg.ok
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 1: 記事一覧取得 */}
      {/* ================================================================== */}
      {step === 'fetch' && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">ブログ記事を取得</h2>
          <p className="text-sm text-slate-500 mb-6">
            MeetSCブログの最新記事一覧を取得します（高速）
          </p>
          <button
            onClick={fetchArticleList}
            disabled={listLoading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {listLoading ? (
              <>
                <Spinner />
                記事一覧を取得中...
              </>
            ) : (
              '記事一覧を取得する'
            )}
          </button>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 2: 記事選択 + 詳細取得（progressive） */}
      {/* ================================================================== */}
      {step === 'select' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              配信する記事を選択（{articleList.length}件）
            </h2>
            <button
              onClick={() => {
                setStep('fetch');
                setArticleList([]);
                setDetailLoaded({});
                setDetailLoading({});
                setSelectedUrl(null);
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              再取得
            </button>
          </div>

          {/* Progress bar for detail loading */}
          {loadingCount > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Spinner className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs text-slate-600">
                  {loadedCount}/{articleList.length} 記事の要約を生成中...
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${articleList.length > 0 ? (loadedCount / articleList.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Article list */}
          <div className="space-y-3">
            {articleList.map((item) => {
              const detail = detailLoaded[item.url];
              const isLoading = detailLoading[item.url] ?? false;
              const isSelected = selectedUrl === item.url;

              return (
                <ArticleCard
                  key={item.url}
                  article={{
                    url: item.url,
                    title: item.title,
                    catchyTitle: detail?.catchyTitle,
                    summaryText: detail?.summaryText,
                    thumbnailUrl: item.thumbnailUrl,
                    category: item.category,
                  }}
                  isSelected={isSelected}
                  isLoading={isLoading}
                  isDetailLoaded={!!detail}
                  onSelect={() => handleSelectArticle(item)}
                />
              );
            })}
          </div>

          {/* Next button */}
          <div className="flex justify-end">
            <button
              onClick={() => setStep('template')}
              disabled={!canProceedToTemplate}
              className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              次へ: テンプレート選択
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 3: テンプレート選択 */}
      {/* ================================================================== */}
      {step === 'template' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">配信テンプレートを選択</h2>
            <button
              onClick={() => setStep('select')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              戻る
            </button>
          </div>
          <TemplateSelector
            templates={TEMPLATE_DEFINITIONS}
            selected={templateId}
            onSelect={setTemplateId}
          />
          <div className="flex justify-end">
            <button
              onClick={() => setStep('confirm')}
              className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              次へ: 確認画面
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 4: 確認・プレビュー・配信 */}
      {/* ================================================================== */}
      {step === 'confirm' && selectedDetail && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">配信内容の確認</h2>
            <button
              onClick={() => setStep('template')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              戻る
            </button>
          </div>

          {/* Side-by-side layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Article info */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-4">
                  {selectedDetail.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedDetail.thumbnailUrl}
                      alt=""
                      className="w-24 h-24 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    {selectedDetail.category && (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-500 mb-2">
                        {selectedDetail.category}
                      </span>
                    )}
                    <p className="text-[10px] text-slate-400 mb-0.5">キャッチタイトル</p>
                    <h3 className="text-base font-bold text-slate-800 mb-3">
                      {selectedDetail.catchyTitle}
                    </h3>
                    <p className="text-[10px] text-slate-400 mb-0.5">要約テキスト</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {selectedDetail.summaryText}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400">記事URL</p>
                    <a
                      href={selectedDetail.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline break-all"
                    >
                      {selectedDetail.url}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400">テンプレート</p>
                    <p className="text-sm font-medium text-slate-700">
                      {TEMPLATE_DEFINITIONS.find((t) => t.id === templateId)?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">配信先</p>
                    <p className="text-sm font-medium text-slate-700">
                      全フォロワー（Broadcast）
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: LINE message preview */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500">LINEメッセージ プレビュー</p>
              </div>
              <div className="p-5 flex justify-center">
                <FlexPreview
                  templateId={templateId}
                  summaryTitle={selectedDetail.catchyTitle}
                  summaryText={selectedDetail.summaryText}
                  thumbnailUrl={selectedDetail.thumbnailUrl}
                  articleUrl={selectedDetail.url}
                  articleCategory={selectedDetail.category || undefined}
                />
              </div>
            </div>
          </div>

          {/* Send button */}
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <button
              onClick={send}
              disabled={sending}
              className="w-full py-3 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Spinner />
                  配信中...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                    />
                  </svg>
                  LINE配信を実行する
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
