'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Segment {
  id: string;
  name: string;
  description: string;
  type: 'static' | 'dynamic';
  rules: Record<string, unknown> | null;
  customer_count: number;
  last_computed_at: string | null;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
}

type ModalMode = 'create' | 'edit';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatDate = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SegmentsPage() {
  const pathname = usePathname();
  const subNav = [
    { label: '顧客一覧', href: '/dashboard/crm' },
    { label: 'セグメント', href: '/dashboard/crm/segments' },
  ];

  // ----- data state -----
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // ----- modal state -----
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<'static' | 'dynamic'>('static');
  const [formRules, setFormRules] = useState('{}');
  const [saving, setSaving] = useState(false);

  // ----- detail / member state -----
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [members, setMembers] = useState<Customer[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [newMemberIds, setNewMemberIds] = useState('');
  const [addingMembers, setAddingMembers] = useState(false);

  // ----- delete confirmation -----
  const [deleteTarget, setDeleteTarget] = useState<Segment | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch segments                                                   */
  /* ---------------------------------------------------------------- */

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/segments');
      if (!res.ok) throw new Error('セグメント一覧の取得に失敗しました');
      const data = await res.json();
      setSegments(data.segments ?? data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  /* ---------------------------------------------------------------- */
  /*  Create / Update                                                  */
  /* ---------------------------------------------------------------- */

  const openCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormName('');
    setFormDesc('');
    setFormType('static');
    setFormRules('{}');
    setModalOpen(true);
  };

  const openEdit = (seg: Segment) => {
    setModalMode('edit');
    setEditingId(seg.id);
    setFormName(seg.name);
    setFormDesc(seg.description);
    setFormType(seg.type);
    setFormRules(seg.rules ? JSON.stringify(seg.rules, null, 2) : '{}');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      let parsedRules: Record<string, unknown> = {};
      if (formType === 'dynamic') {
        try {
          parsedRules = JSON.parse(formRules);
        } catch {
          throw new Error('ルールのJSONが不正です');
        }
      }

      const body = {
        name: formName.trim(),
        description: formDesc.trim(),
        type: formType,
        rules: formType === 'dynamic' ? parsedRules : null,
      };

      const url =
        modalMode === 'create'
          ? '/api/crm/segments'
          : `/api/crm/segments/${editingId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '保存に失敗しました');
      }

      setModalOpen(false);
      setMsg(modalMode === 'create' ? 'セグメントを作成しました' : 'セグメントを更新しました');
      await fetchSegments();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Delete                                                           */
  /* ---------------------------------------------------------------- */

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/crm/segments/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('削除に失敗しました');
      setDeleteTarget(null);
      setMsg('セグメントを削除しました');
      if (selectedSegment?.id === deleteTarget.id) {
        setSelectedSegment(null);
        setShowMembers(false);
      }
      await fetchSegments();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'エラー');
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Members                                                          */
  /* ---------------------------------------------------------------- */

  const fetchMembers = async (segId: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/crm/segments/${segId}/members`);
      if (!res.ok) throw new Error('メンバー取得に失敗しました');
      const data = await res.json();
      setMembers(data.members ?? data ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'エラー');
    } finally {
      setMembersLoading(false);
    }
  };

  const openDetail = (seg: Segment) => {
    setSelectedSegment(seg);
    setShowMembers(false);
    setMembers([]);
  };

  const openMembers = async (seg: Segment) => {
    setSelectedSegment(seg);
    setShowMembers(true);
    await fetchMembers(seg.id);
  };

  const addMembers = async () => {
    if (!selectedSegment || !newMemberIds.trim()) return;
    setAddingMembers(true);
    try {
      const customerIds = newMemberIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/crm/segments/${selectedSegment.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds }),
      });
      if (!res.ok) throw new Error('メンバー追加に失敗しました');
      setNewMemberIds('');
      setMsg('メンバーを追加しました');
      await fetchMembers(selectedSegment.id);
      await fetchSegments();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'エラー');
    } finally {
      setAddingMembers(false);
    }
  };

  const closeDetail = () => {
    setSelectedSegment(null);
    setShowMembers(false);
    setMembers([]);
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 pb-3">
        {subNav.map((item) => {
          const active = item.href === '/dashboard/crm'
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">セグメント管理</h1>
          <p className="text-sm text-slate-400 mt-1">顧客セグメントの作成・管理</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
        >
          + 新規セグメント作成
        </button>
      </div>

      {/* ---------- Flash messages ---------- */}
      {msg && (
        <div className="px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200 flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-green-500 hover:text-green-700 ml-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}

      {/* ---------- Detail / Members panel ---------- */}
      {selectedSegment && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">{selectedSegment.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{selectedSegment.description || '説明なし'}</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedSegment.type === 'static' && !showMembers && (
                <button
                  onClick={() => openMembers(selectedSegment)}
                  className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                >
                  メンバー管理
                </button>
              )}
              <button
                onClick={closeDetail}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="block text-xs font-semibold text-slate-500">タイプ</span>
                <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedSegment.type === 'static'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {selectedSegment.type === 'static' ? '静的' : '動的'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">メンバー数</span>
                <span className="mt-1 block text-sm text-slate-800 font-medium">{selectedSegment.customer_count}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">最終計算日時</span>
                <span className="mt-1 block text-xs text-slate-600">{formatDate(selectedSegment.last_computed_at)}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">作成日時</span>
                <span className="mt-1 block text-xs text-slate-600">{formatDate(selectedSegment.created_at)}</span>
              </div>
            </div>

            {selectedSegment.type === 'dynamic' && selectedSegment.rules && (
              <div>
                <span className="block text-xs font-semibold text-slate-500 mb-1">ルール</span>
                <pre className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 overflow-x-auto border border-slate-100">
                  {JSON.stringify(selectedSegment.rules, null, 2)}
                </pre>
              </div>
            )}

            {/* Members list */}
            {showMembers && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">メンバー一覧</h3>

                {/* Add members form */}
                {selectedSegment.type === 'static' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMemberIds}
                      onChange={(e) => setNewMemberIds(e.target.value)}
                      placeholder="顧客IDをカンマ区切りで入力"
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    />
                    <button
                      onClick={addMembers}
                      disabled={addingMembers || !newMemberIds.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {addingMembers ? '追加中...' : '追加'}
                    </button>
                  </div>
                )}

                {membersLoading ? (
                  <div className="py-6 text-center text-sm text-slate-400">
                    <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-300" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    読み込み中...
                  </div>
                ) : members.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">メンバーはまだ登録されていません</p>
                ) : (
                  <div className="border border-slate-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">ID</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">名前</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">メール</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-2 text-xs text-slate-500 font-mono">{m.id}</td>
                            <td className="px-4 py-2 text-sm text-slate-700">{m.name}</td>
                            <td className="px-4 py-2 text-xs text-slate-500">{m.email || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- Segment list ---------- */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">セグメント名</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">タイプ</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">メンバー数</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">最終計算</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">作成日</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && segments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                  <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-300" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  読み込み中...
                </td>
              </tr>
            ) : segments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                  セグメントはまだ作成されていません。「新規セグメント作成」ボタンから始めましょう。
                </td>
              </tr>
            ) : (
              segments.map((seg) => (
                <tr
                  key={seg.id}
                  className={`border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer ${
                    selectedSegment?.id === seg.id ? 'bg-green-50/40' : ''
                  }`}
                  onClick={() => openDetail(seg)}
                >
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-slate-800">{seg.name}</div>
                    {seg.description && (
                      <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{seg.description}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      seg.type === 'static'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {seg.type === 'static' ? '静的' : '動的'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-700">{seg.customer_count}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{formatDate(seg.last_computed_at)}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{formatDate(seg.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/crm/segments/${seg.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50"
                        title="詳細"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => openEdit(seg)}
                        className="p-1.5 text-slate-400 hover:text-green-600 transition-colors rounded-md hover:bg-green-50"
                        title="編集"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(seg)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                        title="削除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Create / Edit Modal ---------- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg mx-4">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">
                {modalMode === 'create' ? '新規セグメント作成' : 'セグメント編集'}
              </h2>
            </div>

            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  セグメント名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例：VIP顧客"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">説明</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="このセグメントの説明"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">タイプ</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="segType"
                      value="static"
                      checked={formType === 'static'}
                      onChange={() => setFormType('static')}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-slate-700">静的</span>
                    <span className="text-xs text-slate-400">（手動でメンバーを管理）</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="segType"
                      value="dynamic"
                      checked={formType === 'dynamic'}
                      onChange={() => setFormType('dynamic')}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-slate-700">動的</span>
                    <span className="text-xs text-slate-400">（ルールで自動抽出）</span>
                  </label>
                </div>
              </div>

              {/* Static: info */}
              {formType === 'static' && (
                <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                  作成後、セグメント詳細画面の「メンバー管理」からメンバーを追加できます。
                </div>
              )}

              {/* Dynamic: rules */}
              {formType === 'dynamic' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ルール（JSON）</label>
                  <textarea
                    value={formRules}
                    onChange={(e) => setFormRules(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
                    placeholder='{ "field": "purchase_count", "op": ">=", "value": 5 }'
                  />
                  <p className="mt-1 text-xs text-slate-400">条件をJSON形式で記述してください</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : modalMode === 'create' ? '作成' : '更新'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Delete Confirmation Modal ---------- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm mx-4">
            <div className="p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-800">セグメントの削除</h2>
              <p className="text-sm text-slate-600">
                「{deleteTarget.name}」を削除しますか？この操作は取り消せません。
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? '削除中...' : '削除する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
