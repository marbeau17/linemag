'use client';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center p-8">
        <div className="w-16 h-16 rounded-full bg-red-50 grid place-items-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">予期しないエラーが発生しました</h2>
        <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
          {error.message || 'アプリケーションでエラーが発生しました。しばらくしてから再度お試しください。'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
