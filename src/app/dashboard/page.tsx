'use client';

import { useState, useCallback } from 'react';
import ArticleCard from '@/components/line/ArticleCard';
import TemplateSelector from '@/components/line/TemplateSelector';
import { TEMPLATE_DEFINITIONS } from '@/lib/line/templates';
import type { TemplateId } from '@/types/line';

interface ScrapedArticle {
  url: string;
  originalTitle: string;
  catchyTitle: string;
  summaryText: string;
  thumbnailUrl: string | null;
  category: string | null;
}

type Step = 'fetch' | 'select' | 'template' | 'confirm';

export default function DashboardPage() {
  const [step, setStep] = useState<Step>('fetch');
  const [articles, setArticles] = useState<ScrapedArticle[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>('daily-column');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/line/scrape', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setArticles(d.articles || []);
      setStep('select');
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'エラー' }); }
    finally { setLoading(false); }
  }, []);

  const send = useCallback(async () => {
    if (selectedIdx === null) return;
    const a = articles[selectedIdx];
    setSending(true); setMsg(null);
    try {
      const r = await fetch('/api/line/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleUrl: a.url, articleTitle: a.originalTitle,
          summaryTitle: a.catchyTitle, summaryText: a.summaryText,
          thumbnailUrl: a.thumbnailUrl, templateId, articleCategory: a.category,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ ok: true, text: 'LINE配信が完了しました！' });
      setStep('fetch'); setArticles([]); setSelectedIdx(null);
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'エラー' }); }
    finally { setSending(false); }
  }, [articles, selectedIdx, templateId]);

  const sel = selectedIdx !== null ? articles[selectedIdx] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">マニュアル配信</h1>
        <p className="text-sm text-slate-400 mt-1">ブログ記事を取得→AI要約→テンプレート選択→LINE配信</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {([
          { id: 'fetch', l: '1. 記事取得' },
          { id: 'select', l: '2. 記事選択' },
          { id: 'template', l: '3. テンプレート' },
          { id: 'confirm', l: '4. 確認・配信' },
        ] as { id: Step; l: string }[]).map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-slate-200" />}
            <span className={`px-2.5 py-1 rounded-full font-medium ${
              step === s.id ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
            }`}>{s.l}</span>
          </div>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          msg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>{msg.text}</div>
      )}

      {/* Step 1 */}
      {step === 'fetch' && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">ブログ記事を取得</h2>
          <p className="text-sm text-slate-500 mb-6">MeetSCブログの最新記事を取得し、AIが自動で要約を生成します</p>
          <button onClick={fetchArticles} disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
            {loading ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>取得・要約中...</>
            ) : '記事を取得する'}
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 'select' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">配信する記事を選択（{articles.length}件）</h2>
            <button onClick={() => setStep('fetch')} className="text-xs text-slate-400 hover:text-slate-600">再取得</button>
          </div>
          <div className="space-y-3">
            {articles.map((a, i) => (
              <ArticleCard key={a.url} article={a} isSelected={selectedIdx === i} onSelect={() => setSelectedIdx(i)} />
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep('template')} disabled={selectedIdx === null}
              className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors">
              次へ: テンプレート選択
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 'template' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">配信テンプレートを選択</h2>
            <button onClick={() => setStep('select')} className="text-xs text-slate-400 hover:text-slate-600">戻る</button>
          </div>
          <TemplateSelector templates={TEMPLATE_DEFINITIONS} selected={templateId} onSelect={setTemplateId} />
          <div className="flex justify-end">
            <button onClick={() => setStep('confirm')}
              className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
              次へ: 確認画面
            </button>
          </div>
        </div>
      )}

      {/* Step 4 */}
      {step === 'confirm' && sel && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">配信内容の確認</h2>
            <button onClick={() => setStep('template')} className="text-xs text-slate-400 hover:text-slate-600">戻る</button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-4">
                {sel.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sel.thumbnailUrl} alt="" className="w-24 h-24 rounded-lg object-cover shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 mb-1">キャッチタイトル</p>
                  <h3 className="text-base font-bold text-slate-800 mb-2">{sel.catchyTitle}</h3>
                  <p className="text-[10px] text-slate-400 mb-1">要約テキスト</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{sel.summaryText}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400">テンプレート</p>
                  <p className="text-sm font-medium text-slate-700">{TEMPLATE_DEFINITIONS.find(t => t.id === templateId)?.name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">配信先</p>
                  <p className="text-sm font-medium text-slate-700">全フォロワー（Broadcast）</p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
              <button onClick={send} disabled={sending}
                className="w-full py-3 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {sending ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>配信中...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>LINE配信を実行する</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
