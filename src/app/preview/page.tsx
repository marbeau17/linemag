'use client';

import { useState, useEffect } from 'react';
import FlexPreview from '@/components/line/FlexPreview';
import { TEMPLATE_DEFINITIONS } from '@/lib/line/templates';
import type { TemplateId } from '@/types/line';

interface PreviewData {
  summaryTitle: string;
  summaryText: string;
  thumbnailUrl: string | null;
  articleUrl: string;
  articleCategory?: string;
  selectedTemplateId: TemplateId;
}

export default function PreviewPage() {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('linemag-preview');
      if (!raw) { setError(true); return; }
      setData(JSON.parse(raw));
    } catch {
      setError(true);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-slate-800 mb-2">プレビューデータがありません</p>
          <p className="text-sm text-slate-500">ダッシュボードからプレビューを開いてください</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div>
            <h1 className="text-sm font-bold text-slate-800">LINEメッセージ プレビュー</h1>
            <p className="text-xs text-slate-400 truncate max-w-md">{data.summaryTitle}</p>
          </div>
          <button
            onClick={() => window.close()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ウィンドウを閉じる
          </button>
        </div>
      </header>

      {/* Template grid */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {TEMPLATE_DEFINITIONS.map((tmpl) => {
            const isSelected = tmpl.id === data.selectedTemplateId;
            return (
              <div
                key={tmpl.id}
                className={`relative rounded-2xl p-4 transition-all ${
                  isSelected
                    ? 'bg-green-50 ring-2 ring-green-500 shadow-lg'
                    : 'bg-white border border-slate-200 shadow-sm'
                }`}
              >
                {/* Template label */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{tmpl.name}</h3>
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-500">
                      {tmpl.category}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-green-700 bg-green-100 rounded-full">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      選択中
                    </span>
                  )}
                </div>

                {/* Preview */}
                <FlexPreview
                  templateId={tmpl.id}
                  summaryTitle={data.summaryTitle}
                  summaryText={data.summaryText}
                  thumbnailUrl={data.thumbnailUrl}
                  articleUrl={data.articleUrl}
                  articleCategory={data.articleCategory}
                />
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
