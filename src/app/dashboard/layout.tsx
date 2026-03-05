'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'マニュアル配信', href: '/dashboard' },
  { label: 'スケジュール', href: '/dashboard/schedule' },
  { label: '配信履歴', href: '/dashboard/history' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 grid place-items-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-800">LineMag</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((n) => {
              const active = n.href === '/dashboard' ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
