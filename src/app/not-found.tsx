import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-300 mb-4">404</h1>
        <p className="text-slate-600 mb-6">ページが見つかりませんでした</p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            ホームに戻る
          </Link>
          <Link href="/login" className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors">
            ログイン
          </Link>
        </div>
      </div>
    </div>
  );
}
