'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

/* ───── types ───── */

interface Customer {
  id: string;
  line_user_id: string;
  display_name: string;
  picture_url?: string;
  email?: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  prefecture?: string;
  membership_tier?: string;
  message_count?: number;
  first_seen_at: string;
  last_seen_at: string;
  attributes?: Record<string, unknown>;
}

interface CustomerAction {
  id: string;
  action_type: string;
  detail?: string;
  created_at: string;
}

interface Tag {
  tag: string;
}

/* ───── constants ───── */

const ACTION_LABELS: Record<string, string> = {
  message_received: 'メッセージ受信',
  follow: '友だち追加',
  unfollow: 'ブロック',
  link_tap: 'リンクタップ',
  purchase: '購入',
  coupon_use: 'クーポン利用',
  reservation: '予約',
  page_view: 'ページ閲覧',
};

const ACTION_ICONS: Record<string, string> = {
  message_received: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  follow: 'M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z',
  unfollow: 'M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z',
  link_tap: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
  purchase: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
  coupon_use: 'M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z',
  reservation: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  page_view: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

const TIER_COLORS: Record<string, string> = {
  gold: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  silver: 'bg-slate-100 text-slate-600 border-slate-300',
  bronze: 'bg-orange-100 text-orange-700 border-orange-300',
  platinum: 'bg-violet-100 text-violet-700 border-violet-300',
};

const GENDER_OPTIONS = [
  { value: '', label: '未設定' },
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'other', label: 'その他' },
];

/* ───── helpers ───── */

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}日前`;
  return formatDate(iso);
}

/* ───── spinner ───── */

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <svg className="animate-spin w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

/* ───── page ───── */

export default function CrmCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [actions, setActions] = useState<CustomerAction[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // edit form
  const [editForm, setEditForm] = useState({
    email: '',
    phone: '',
    gender: '',
    birth_date: '',
    prefecture: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // tag input
  const [newTag, setNewTag] = useState('');
  const [tagLoading, setTagLoading] = useState(false);

  /* ── fetch ── */

  const fetchCustomer = useCallback(async () => {
    const res = await fetch(`/api/crm/customers/${id}`);
    if (!res.ok) throw new Error('顧客情報の取得に失敗しました');
    return res.json();
  }, [id]);

  const fetchTags = useCallback(async () => {
    const res = await fetch(`/api/crm/customers/${id}/tags`);
    if (!res.ok) throw new Error('タグの取得に失敗しました');
    return res.json();
  }, [id]);

  const fetchActions = useCallback(async () => {
    const res = await fetch(`/api/crm/customers/${id}/actions?limit=20`);
    if (!res.ok) throw new Error('アクション履歴の取得に失敗しました');
    return res.json();
  }, [id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cust, tagData, actionData] = await Promise.all([
        fetchCustomer(),
        fetchTags(),
        fetchActions(),
      ]);
      setCustomer(cust);
      setTags((tagData.tags ?? tagData).map((t: Tag | string) => (typeof t === 'string' ? t : t.tag)));
      setActions(actionData.actions ?? actionData);
      setEditForm({
        email: cust.email ?? '',
        phone: cust.phone ?? '',
        gender: cust.gender ?? '',
        birth_date: cust.birth_date ?? '',
        prefecture: cust.prefecture ?? '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [fetchCustomer, fetchTags, fetchActions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── profile edit ── */

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/crm/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      const updated = await res.json();
      setCustomer(updated);
      setSaveMsg('保存しました');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  /* ── tags ── */

  async function handleAddTag() {
    const tag = newTag.trim();
    if (!tag) return;
    setTagLoading(true);
    try {
      const res = await fetch(`/api/crm/customers/${id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      });
      if (!res.ok) throw new Error('タグの追加に失敗しました');
      setTags((prev) => [...prev, tag]);
      setNewTag('');
    } catch {
      // silently fail
    } finally {
      setTagLoading(false);
    }
  }

  async function handleRemoveTag(tag: string) {
    setTagLoading(true);
    try {
      const res = await fetch(`/api/crm/customers/${id}/tags?tag=${encodeURIComponent(tag)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('タグの削除に失敗しました');
      setTags((prev) => prev.filter((t) => t !== tag));
    } catch {
      // silently fail
    } finally {
      setTagLoading(false);
    }
  }

  /* ── render ── */

  if (loading) return <Spinner />;

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/crm" className="text-sm text-green-600 hover:text-green-700 font-medium">
          &larr; 顧客一覧に戻る
        </Link>
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error ?? '顧客が見つかりません'}
        </div>
      </div>
    );
  }

  const tierClass = TIER_COLORS[customer.membership_tier ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-300';

  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <Link href="/dashboard/crm" className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        顧客一覧に戻る
      </Link>

      {/* two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── LEFT COLUMN (2/3) ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-4">
              {customer.picture_url ? (
                <img
                  src={customer.picture_url}
                  alt={customer.display_name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-100"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 grid place-items-center text-white text-xl font-bold">
                  {customer.display_name?.charAt(0) ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-800 truncate">{customer.display_name}</h1>
                  {customer.membership_tier && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${tierClass}`}>
                      {customer.membership_tier}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5 truncate">LINE ID: {customer.line_user_id}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span>初回: {formatDate(customer.first_seen_at)}</span>
                  <span>最終: {formatDate(customer.last_seen_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Basic info (editable) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">基本情報</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">メールアドレス</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                  placeholder="example@mail.com"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">電話番号</span>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                  placeholder="090-xxxx-xxxx"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">性別</span>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition bg-white"
                >
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">生年月日</span>
                <input
                  type="date"
                  value={editForm.birth_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, birth_date: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-slate-500">都道府県</span>
                <input
                  type="text"
                  value={editForm.prefecture}
                  onChange={(e) => setEditForm((f) => ({ ...f, prefecture: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                  placeholder="東京都"
                />
              </label>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              {saveMsg && (
                <span className={`text-xs font-medium ${saveMsg === '保存しました' ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>

          {/* Activity timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">アクティビティ</h2>
            {actions.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">アクティビティはまだありません</p>
            ) : (
              <div className="space-y-0">
                {actions.map((a, i) => {
                  const iconPath = ACTION_ICONS[a.action_type] ?? ACTION_ICONS.page_view;
                  const label = ACTION_LABELS[a.action_type] ?? a.action_type;
                  return (
                    <div key={a.id ?? i} className="relative flex gap-3 pb-5 last:pb-0">
                      {/* vertical line */}
                      {i < actions.length - 1 && (
                        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />
                      )}
                      {/* icon */}
                      <div className="relative z-10 w-8 h-8 rounded-full bg-slate-100 grid place-items-center shrink-0">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                        </svg>
                      </div>
                      {/* content */}
                      <div className="pt-0.5 min-w-0">
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">{label}</span>
                          {a.detail && <span className="text-slate-500"> &mdash; {a.detail}</span>}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{relativeTime(a.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT COLUMN (1/3) ─── */}
        <div className="space-y-6">
          {/* Tags card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">タグ</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.length === 0 && <p className="text-xs text-slate-400">タグなし</p>}
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    disabled={tagLoading}
                    className="ml-0.5 text-green-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    aria-label={`${tag}を削除`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddTag();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="新しいタグ"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
              />
              <button
                type="submit"
                disabled={tagLoading || !newTag.trim()}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                追加
              </button>
            </form>
          </div>

          {/* Stats card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">統計</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-xs text-slate-500">メッセージ数</dt>
                <dd className="text-sm font-semibold text-slate-800">{customer.message_count ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-slate-500">アクション数</dt>
                <dd className="text-sm font-semibold text-slate-800">{actions.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-slate-500">メンバー登録日</dt>
                <dd className="text-sm font-semibold text-slate-800">{formatDate(customer.first_seen_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Attributes card */}
          {customer.attributes && Object.keys(customer.attributes).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">カスタム属性</h2>
              <dl className="space-y-2">
                {Object.entries(customer.attributes).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <dt className="text-xs text-slate-500 truncate">{key}</dt>
                    <dd className="text-sm text-slate-700 text-right truncate">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
