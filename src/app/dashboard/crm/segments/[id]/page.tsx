'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Segment {
  id: string;
  name: string;
  description: string | null;
  type: 'static' | 'dynamic';
  rules: SegmentRule[];
  autoRefresh: boolean;
  lastComputedAt: string | null;
  customerCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SegmentRule {
  field: string;
  operator: string;
  value: unknown;
}

interface Customer {
  id: string;
  displayName: string | null;
  email: string | null;
  membershipTier: string | null;
  prefecture: string | null;
  lastSeenAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  prefecture: '都道府県',
  membership_tier: '会員ランク',
  tag: 'タグ',
  last_seen_at: '最終アクセス日',
  gender: '性別',
  message_count: 'メッセージ数',
  first_seen_at: '初回アクセス日',
  email: 'メールアドレス',
  birth_date: '生年月日',
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: '=',
  neq: '!=',
  contains: 'を含む',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  in: 'のいずれか',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatRuleValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '-';
  return String(value);
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Segment state
  const [segment, setSegment] = useState<Segment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Members state
  const [members, setMembers] = useState<Customer[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Add member modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch segment info
  // ---------------------------------------------------------------------------

  const fetchSegment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/segments/${id}`);
      if (!res.ok) throw new Error('セグメントの取得に失敗しました');
      const data = await res.json();
      setSegment(data.segment);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ---------------------------------------------------------------------------
  // Fetch members
  // ---------------------------------------------------------------------------

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/crm/segments/${id}/members`);
      if (!res.ok) throw new Error('メンバーの取得に失敗しました');
      const data = await res.json();
      const customerIds: string[] = data.customerIds ?? [];

      if (customerIds.length === 0) {
        setMembers([]);
        return;
      }

      // Fetch customer details in batches of 20
      const allCustomers: Customer[] = [];
      for (let i = 0; i < customerIds.length; i += 20) {
        const batch = customerIds.slice(i, i + 20);
        const promises = batch.map(async (cid) => {
          try {
            const r = await fetch(`/api/crm/customers/${cid}`);
            if (!r.ok) return null;
            const d = await r.json();
            return d.customer as Customer;
          } catch {
            return null;
          }
        });
        const results = await Promise.all(promises);
        allCustomers.push(...results.filter((c): c is Customer => c !== null));
      }
      setMembers(allCustomers);
    } catch {
      // Silently fail — segment info still visible
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSegment();
    fetchMembers();
  }, [fetchSegment, fetchMembers]);

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------

  function startEdit() {
    if (!segment) return;
    setEditName(segment.name);
    setEditDescription(segment.description ?? '');
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/segments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDescription || null }),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      const data = await res.json();
      setSegment(data.segment);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Remove member
  // ---------------------------------------------------------------------------

  async function handleRemoveMember(customerId: string) {
    if (!confirm('このメンバーをセグメントから削除しますか？')) return;
    setRemovingId(customerId);
    try {
      const res = await fetch(
        `/api/crm/segments/${id}/members?customerId=${customerId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('削除に失敗しました');
      setMembers((prev) => prev.filter((m) => m.id !== customerId));
      // Refresh segment to update count
      fetchSegment();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setRemovingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Customer search (for add modal)
  // ---------------------------------------------------------------------------

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/crm/customers?search=${encodeURIComponent(searchQuery.trim())}&perPage=10`,
      );
      if (!res.ok) throw new Error('検索に失敗しました');
      const data = await res.json();
      setSearchResults(data.customers ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function toggleSelect(customerId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  async function handleAddMembers() {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/crm/segments/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('追加に失敗しました');
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedIds(new Set());
      fetchMembers();
      fetchSegment();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setAdding(false);
    }
  }

  function closeModal() {
    setShowAddModal(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedIds(new Set());
  }

  // ---------------------------------------------------------------------------
  // Loading / Error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-2 text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  if (error || !segment) {
    return (
      <div className="space-y-4">
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error || 'セグメントが見つかりません'}
        </div>
        <Link
          href="/dashboard/crm/segments"
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          セグメント一覧に戻る
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const memberIds = new Set(members.map((m) => m.id));

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/crm/segments"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        セグメント一覧
      </Link>

      {/* ------------------------------------------------------------------ */}
      {/*  Segment Info Header                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          {editing ? (
            /* ---- Edit form ---- */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">セグメント名</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">説明</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !editName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            /* ---- Display mode ---- */
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold text-slate-800">{segment.name}</h1>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      segment.type === 'dynamic'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {segment.type === 'dynamic' ? '動的' : '静的'}
                  </span>
                </div>
                {segment.description && (
                  <p className="text-sm text-slate-500 mt-1">{segment.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span>顧客数: {segment.customerCount}人</span>
                  <span>最終更新: {formatDate(segment.lastComputedAt)}</span>
                </div>
              </div>
              <button
                onClick={startEdit}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
              >
                編集
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Rules section (dynamic segments only)                             */}
      {/* ------------------------------------------------------------------ */}
      {segment.type === 'dynamic' && segment.rules.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">ルール</h2>
          </div>
          <div className="p-5 space-y-2">
            {segment.rules.map((rule, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 text-sm"
              >
                <span className="font-medium text-slate-700">
                  {FIELD_LABELS[rule.field] ?? rule.field}
                </span>
                <span className="text-slate-400">
                  {OPERATOR_LABELS[rule.operator] ?? rule.operator}
                </span>
                <span className="text-slate-800 font-medium">
                  {formatRuleValue(rule.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Members section                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            メンバー
            {!membersLoading && (
              <span className="ml-1.5 text-xs font-normal text-slate-400">
                ({members.length}人)
              </span>
            )}
          </h2>
          {segment.type === 'static' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              顧客を追加
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  顧客名
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  メール
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  会員ランク
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  都道府県
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  最終アクセス
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {membersLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                    <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-300" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    読み込み中...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                    メンバーはまだいません。
                    {segment.type === 'static' && '「顧客を追加」ボタンから追加できます。'}
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50"
                  >
                    <td className="px-5 py-3 text-sm text-slate-700 font-medium">
                      <Link
                        href={`/dashboard/crm/${member.id}`}
                        className="hover:text-green-600 transition-colors"
                      >
                        {member.displayName || '(名前なし)'}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {member.email || '-'}
                    </td>
                    <td className="px-5 py-3">
                      {member.membershipTier ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          {member.membershipTier}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {member.prefecture || '-'}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {formatDate(member.lastSeenAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removingId === member.id}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors"
                      >
                        {removingId === member.id ? '削除中...' : 'メンバーを削除'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Add Member Modal                                                  */}
      {/* ------------------------------------------------------------------ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-800">顧客を追加</h3>
              <button
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-100 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  placeholder="顧客名で検索..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {searching ? '検索中...' : '検索'}
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {searchResults.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  {searching ? '検索中...' : '顧客名を入力して検索してください'}
                </p>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((customer) => {
                    const alreadyMember = memberIds.has(customer.id);
                    const selected = selectedIds.has(customer.id);
                    return (
                      <label
                        key={customer.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                          alreadyMember
                            ? 'opacity-50 cursor-not-allowed'
                            : selected
                              ? 'bg-green-50'
                              : 'hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={alreadyMember}
                          onChange={() => toggleSelect(customer.id)}
                          className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500/20"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {customer.displayName || '(名前なし)'}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {customer.email || customer.prefecture || '-'}
                          </p>
                        </div>
                        {alreadyMember && (
                          <span className="text-xs text-slate-400 shrink-0">追加済み</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">
                {selectedIds.size > 0 ? `${selectedIds.size}件選択中` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddMembers}
                  disabled={adding || selectedIds.size === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {adding ? '追加中...' : '追加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
