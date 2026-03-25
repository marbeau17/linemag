import Link from 'next/link';

const features = [
  {
    title: 'ブログ配信',
    description: 'AI要約でブログ記事をLINE Flex Messageで自動配信。5種類のテンプレートから選択可能。',
    href: '/dashboard/broadcast',
    iconBg: 'bg-green-50 text-green-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    ),
  },
  {
    title: 'CRM・顧客管理',
    description: '顧客プロファイル・タグ・セグメント管理。LINE友だちの行動を一元管理。',
    href: '/dashboard/crm',
    iconBg: 'bg-blue-50 text-blue-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    ),
  },
  {
    title: 'クーポン',
    description: 'クーポン作成・セグメント別配布・利用追跡。効果測定まで一括管理。',
    href: '/dashboard/coupons',
    iconBg: 'bg-amber-50 text-amber-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    ),
  },
  {
    title: '予約管理',
    description: '相談窓口のタイムスロット予約。Google Meet連携で自動招待配信。',
    href: '/dashboard/reservations',
    iconBg: 'bg-rose-50 text-rose-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    ),
  },
  {
    title: 'マーケティング',
    description: 'シナリオ配信・A/Bテスト・トリガー配信で顧客エンゲージメントを最大化。',
    href: '/dashboard/ma',
    iconBg: 'bg-purple-50 text-purple-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    ),
  },
  {
    title: '分析ダッシュボード',
    description: 'KPI可視化・配信効果・顧客分析・レポート出力で施策をデータドリブンに。',
    href: '/dashboard/analytics',
    iconBg: 'bg-teal-50 text-teal-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    ),
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 grid place-items-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-800">LineMag</span>
          </div>
          <Link
            href="/login"
            className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            ログイン
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-20 pb-16">
        <div className="text-center max-w-2xl">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 grid place-items-center shadow-lg shadow-green-600/20">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">LineMag</h1>
          <p className="text-lg font-medium text-slate-700 mb-2">
            LINE公式アカウント統合管理プラットフォーム
          </p>
          <p className="text-slate-500 mb-10">
            ブログ配信・CRM・クーポン・予約・MA・分析を一つのダッシュボードで管理
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 text-base"
          >
            ダッシュボードを開く
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Feature Cards — all clickable with links */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">主な機能</h2>
          <p className="text-sm text-slate-500">各カードをクリックして管理画面に移動</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-green-200 transition-all"
            >
              <div className={`w-11 h-11 rounded-xl ${feature.iconBg} grid place-items-center mb-4 group-hover:scale-110 transition-transform`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  {feature.icon}
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
                {feature.title}
                <svg className="w-4 h-4 text-slate-300 group-hover:text-green-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {feature.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-green-400 to-green-600 grid place-items-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <span className="text-sm text-slate-500">&copy; 2026 LineMag</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-slate-500 hover:text-green-600 transition-colors">管理者ログイン</Link>
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-green-600 transition-colors">ダッシュボード</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
