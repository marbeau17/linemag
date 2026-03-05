'use client';

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">配信履歴</h1>
        <p className="text-sm text-slate-400 mt-1">過去のLINE配信の記録</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">日時</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">記事タイトル</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">テンプレート</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">ステータス</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                配信履歴はまだありません。マニュアル配信またはスケジュール配信を実行すると、ここに記録されます。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
