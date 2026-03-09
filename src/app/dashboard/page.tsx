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

interface LineFollower {
  userId: string;
  displayName: string;
  pictureUrl?: string;
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

// ─── Back Arrow Icon (reused) ────────────────────────────────────────────────

function BackArrow() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
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
  const [testSending, setTestSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Delivery mode
  const [deliveryMode, setDeliveryMode] = useState<'broadcast' | 'push'>('broadcast');
  const [pushUserId, setPushUserId] = useState('');
  const [pushSending, setPushSending] = useState(false);

  // Follower list
  const [followers, setFollowers] = useState<LineFollower[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followersLoaded, setFollowersLoaded] = useState(false);
  const [followerSearch, setFollowerSearch] = useState('');

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
      setPage(0);
      setCategoryFilter('all');
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

  // ── Test broadcast (admin only) ───────────────────────────────────────────

  const sendTest = useCallback(async () => {
    if (!selectedUrl) return;
    const detail = detailLoaded[selectedUrl];
    if (!detail) return;

    setTestSending(true);
    setMsg(null);
    try {
      const r = await fetch('/api/line/test-broadcast', {
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
      setMsg({ ok: true, text: 'テスト配信が完了しました。LINEアプリで確認してください。' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'テスト配信に失敗しました' });
    } finally {
      setTestSending(false);
    }
  }, [selectedUrl, detailLoaded, templateId]);

  // ── Individual push ─────────────────────────────────────────────────────────

  const sendPush = useCallback(async () => {
    if (!selectedUrl || !pushUserId.trim()) return;
    const detail = detailLoaded[selectedUrl];
    if (!detail) return;

    setPushSending(true);
    setMsg(null);
    try {
      const r = await fetch('/api/line/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pushUserId.trim(),
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
      setMsg({ ok: true, text: `個別配信が完了しました（User ID: ${pushUserId.trim()}）` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '個別配信に失敗しました' });
    } finally {
      setPushSending(false);
    }
  }, [selectedUrl, detailLoaded, templateId, pushUserId]);

  // ── Fetch followers ─────────────────────────────────────────────────────────

  const fetchFollowers = useCallback(async () => {
    setFollowersLoading(true);
    setMsg(null);
    try {
      const r = await fetch('/api/line/followers');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setFollowers(d.followers || []);
      setFollowersLoaded(true);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'フォロワー取得に失敗しました' });
    } finally {
      setFollowersLoading(false);
    }
  }, []);

  // ── Preview in new window ─────────────────────────────────────────────────

  const openPreviewWindow = () => {
    if (!selectedDetail) return;
    const previewData = {
      summaryTitle: selectedDetail.catchyTitle,
      summaryText: selectedDetail.summaryText,
      thumbnailUrl: selectedDetail.thumbnailUrl,
      articleUrl: selectedDetail.url,
      articleCategory: selectedDetail.category,
      selectedTemplateId: templateId,
    };
    localStorage.setItem('linemag-preview', JSON.stringify(previewData));
    window.open('/preview', '_blank', 'width=1200,height=800');
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const selectedDetail = selectedUrl ? detailLoaded[selectedUrl] : null;
  const selectedItem = articleList.find((a) => a.url === selectedUrl) ?? null;

  const loadedCount = Object.keys(detailLoaded).length;
  const loadingCount = Object.values(detailLoading).filter(Boolean).length;

  const filteredFollowers = followerSearch
    ? followers.filter(
        (f) =>
          f.displayName.toLowerCase().includes(followerSearch.toLowerCase()) ||
          f.userId.toLowerCase().includes(followerSearch.toLowerCase())
      )
    : followers;

  // Can proceed to template step only if selected article has detail loaded
  const canProceedToTemplate = selectedUrl !== null && selectedDetail !== null;

  // ── Categories and filtered/paginated articles ──────────────────────────────

  const categories = Array.from(new Set(articleList.map((a) => a.category).filter(Boolean))) as string[];

  const filteredArticles = categoryFilter === 'all'
    ? articleList
    : articleList.filter((a) => a.category === categoryFilter);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const paginatedArticles = filteredArticles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Suppress unused variable warning
  void selectedItem;

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
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-slate-800">
              配信する記事を選択（{filteredArticles.length}件）
            </h2>
            {/* Category filter */}
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(0);
                }}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md"
              >
                <option value="all">すべてのカテゴリー</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <button
              onClick={fetchArticleList}
              disabled={listLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {listLoading ? (
                <Spinner className="w-3 h-3" />
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              )}
              再取得
            </button>
          </div>

          {/* Progress bar for detail loading */}
          {loadingCount > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Spinner className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs text-slate-600">
                  {loadedCount}/{filteredArticles.length} 記事の要約を生成中...
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${filteredArticles.length > 0 ? (loadedCount / filteredArticles.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Article list */}
          <div className="space-y-3">
            {paginatedArticles.map((item) => {
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30 transition-colors"
              >
                <BackArrow />
                前へ
              </button>
              <span className="text-xs text-slate-500">
                ページ {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30 transition-colors"
              >
                次へ
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}

          {/* Bottom navigation bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setStep('fetch');
                setArticleList([]);
                setDetailLoaded({});
                setDetailLoading({});
                setSelectedUrl(null);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <BackArrow />
              記事一覧に戻る
            </button>
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
          <div>
            <h2 className="text-sm font-bold text-slate-800">配信テンプレートを選択</h2>
          </div>
          <TemplateSelector
            templates={TEMPLATE_DEFINITIONS}
            selected={templateId}
            onSelect={setTemplateId}
          />
          {/* Bottom navigation bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('select')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <BackArrow />
              記事選択に戻る
            </button>
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
          <div>
            <h2 className="text-sm font-bold text-slate-800">配信内容の確認</h2>
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
                    <div className="flex items-center gap-2 mt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="deliveryMode"
                          value="broadcast"
                          checked={deliveryMode === 'broadcast'}
                          onChange={() => setDeliveryMode('broadcast')}
                          className="accent-green-600"
                        />
                        <span className="text-xs text-slate-700">全体配信</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="deliveryMode"
                          value="push"
                          checked={deliveryMode === 'push'}
                          onChange={() => setDeliveryMode('push')}
                          className="accent-green-600"
                        />
                        <span className="text-xs text-slate-700">個別配信</span>
                      </label>
                    </div>
                    {deliveryMode === 'push' && (
                      <div className="mt-2 space-y-2">
                        {/* Fetch followers button */}
                        {!followersLoaded && (
                          <button
                            onClick={fetchFollowers}
                            disabled={followersLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            {followersLoading ? (
                              <>
                                <Spinner className="w-3 h-3" />
                                フォロワー取得中...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                </svg>
                                フォロワー一覧を取得
                              </>
                            )}
                          </button>
                        )}

                        {/* Follower list */}
                        {followersLoaded && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            {/* Search */}
                            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                              <input
                                type="text"
                                placeholder="ユーザー検索..."
                                value={followerSearch}
                                onChange={(e) => setFollowerSearch(e.target.value)}
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                              />
                            </div>
                            {/* List */}
                            <div className="max-h-48 overflow-y-auto">
                              {filteredFollowers.length === 0 && (
                                <p className="px-3 py-3 text-xs text-slate-400 text-center">
                                  {followerSearch ? '該当するユーザーがいません' : 'フォロワーがいません'}
                                </p>
                              )}
                              {filteredFollowers.map((f) => (
                                <button
                                  key={f.userId}
                                  onClick={() => setPushUserId(f.userId)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0 ${
                                    pushUserId === f.userId ? 'bg-green-50' : ''
                                  }`}
                                >
                                  {/* Avatar */}
                                  {f.pictureUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={f.pictureUrl}
                                      alt=""
                                      className="w-7 h-7 rounded-full object-cover shrink-0"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-slate-800 truncate">
                                      {f.displayName}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate">
                                      {f.userId}
                                    </p>
                                  </div>
                                  {pushUserId === f.userId && (
                                    <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                            {/* Footer */}
                            <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">
                                {followers.length}人のフォロワー
                              </span>
                              <button
                                onClick={fetchFollowers}
                                disabled={followersLoading}
                                className="text-[10px] text-blue-500 hover:text-blue-700"
                              >
                                再取得
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Manual input fallback */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">または手動入力:</span>
                          <input
                            type="text"
                            placeholder="LINE User ID (U...)"
                            value={pushUserId}
                            onChange={(e) => setPushUserId(e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: LINE message preview */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">LINEメッセージ プレビュー</p>
                <button
                  onClick={openPreviewWindow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  別ウィンドウでプレビュー
                </button>
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

          {/* Bottom navigation bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('template')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <BackArrow />
              テンプレート選択に戻る
            </button>
            <div>{/* Spacer - send button is in the card below */}</div>
          </div>

          {/* Send buttons */}
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 space-y-3">
            {/* Test broadcast button */}
            <button
              onClick={sendTest}
              disabled={testSending || sending}
              className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {testSending ? (
                <>
                  <Spinner />
                  テスト配信中...
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
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  テスト配信（自分のみ）
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              管理者のLINEにのみ送信されます。
              {deliveryMode === 'push' && pushUserId && (
                <span className="block mt-0.5">
                  個別配信先: {followers.find(f => f.userId === pushUserId)?.displayName || pushUserId}
                </span>
              )}
            </p>

            <div className="h-px bg-slate-100" />

            {/* Full broadcast button */}
            <button
              onClick={send}
              disabled={sending || testSending}
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
                  LINE配信を実行する（全フォロワー）
                </>
              )}
            </button>
            {deliveryMode === 'push' && (
              <>
                <div className="h-px bg-slate-100" />
                <button
                  onClick={sendPush}
                  disabled={pushSending || !pushUserId.trim() || sending || testSending}
                  className="w-full py-3 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {pushSending ? (
                    <>
                      <Spinner />
                      個別配信中...
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
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                        />
                      </svg>
                      個別配信を実行する
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
