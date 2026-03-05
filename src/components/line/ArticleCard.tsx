'use client';

interface Props {
  article: {
    url: string;
    originalTitle: string;
    catchyTitle: string;
    summaryText: string;
    thumbnailUrl: string | null;
    category: string | null;
  };
  isSelected: boolean;
  onSelect: () => void;
}

export default function ArticleCard({ article, isSelected, onSelect }: Props) {
  return (
    <button onClick={onSelect}
      className={`w-full text-left rounded-xl border-2 overflow-hidden transition-all duration-200 ${
        isSelected ? 'border-green-500 bg-green-50/50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex">
        <div className="w-28 h-28 sm:w-36 sm:h-36 shrink-0 bg-slate-100 overflow-hidden">
          {article.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.thumbnailUrl} alt={article.originalTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 p-4 min-w-0">
          {article.category && (
            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-500 mb-1.5">{article.category}</span>
          )}
          <h3 className="text-sm font-bold text-slate-800 leading-snug mb-1 line-clamp-2">{article.catchyTitle}</h3>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{article.summaryText}</p>
        </div>
        <div className="flex items-center pr-4">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSelected ? 'border-green-500 bg-green-500' : 'border-slate-300'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
