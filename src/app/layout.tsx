import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LineMag — ブログ自動要約・LINE配信',
  description: 'ブログ記事をAI要約してLINE公式アカウントからマガジン配信するシステム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-800 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
