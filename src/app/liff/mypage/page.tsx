'use client';

import Link from 'next/link';

// ---------------------------------------------------------------------------
// Hardcoded profile (LIFF auth comes later)
// ---------------------------------------------------------------------------
const PROFILE = {
  name: 'ゲストユーザー',
  pictureUrl: null as string | null,
  lineId: 'U0000000000',
};

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------
const MENU_ITEMS = [
  {
    label: '予約する',
    href: '/liff/booking',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    description: '新しい予約を作成',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    label: 'マイクーポン',
    href: '/liff/coupons',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
    description: 'クーポンを確認・利用',
    color: 'bg-green-50 text-green-600',
  },
  {
    label: '予約履歴',
    href: '/liff/reservations',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: '過去の予約を確認',
    color: 'bg-purple-50 text-purple-600',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LiffMyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Profile header */}
      <div className="bg-[#06C755] px-4 pt-12 pb-8">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
            {PROFILE.pictureUrl ? (
              <img
                src={PROFILE.pictureUrl}
                alt={PROFILE.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            )}
          </div>

          {/* Name & ID */}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">
              {PROFILE.name}
            </h1>
            <p className="text-sm text-white/70 mt-0.5">
              LINE ID: {PROFILE.lineId}
            </p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {MENU_ITEMS.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors ${
                index < MENU_ITEMS.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                {item.icon}
              </div>

              {/* Label & description */}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-slate-800">
                  {item.label}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.description}
                </p>
              </div>

              {/* Chevron */}
              <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 mt-8 pb-8">
        <p className="text-center text-xs text-slate-300">
          LineMag v1.0
        </p>
      </div>
    </div>
  );
}
