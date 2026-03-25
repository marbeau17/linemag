'use client';

export default function LiffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 bg-white">
      <div className="w-14 h-14 rounded-full bg-red-50 grid place-items-center mb-4">
        <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-slate-800 mb-2">エラーが発生しました</h2>
      <p className="text-sm text-slate-500 mb-6 text-center px-4">
        {error.message || '読み込み中にエラーが発生しました。'}
      </p>
      <button
        onClick={reset}
        className="w-full max-w-xs px-4 py-3 bg-green-500 text-white text-sm font-medium rounded-full hover:bg-green-600 active:bg-green-700 transition-colors"
      >
        再試行する
      </button>
    </div>
  );
}
