'use client';

import type { TemplateId, TemplateDefinition } from '@/types/line';

interface Props {
  templates: TemplateDefinition[];
  selected: TemplateId;
  onSelect: (id: TemplateId) => void;
}

export default function TemplateSelector({ templates, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((t) => {
        const on = selected === t.id;
        return (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              on ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200'
                 : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            {on && (
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="w-full h-2 rounded-full mb-3" style={{ backgroundColor: t.previewColor }} />
            <h3 className="text-sm font-bold text-slate-800 mb-1">{t.name}</h3>
            <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-500 mb-2">{t.category}</span>
            <p className="text-xs text-slate-500 leading-relaxed">{t.description}</p>
            <p className="text-[10px] text-slate-400 mt-2">{t.recommendedFor}</p>
          </button>
        );
      })}
    </div>
  );
}
