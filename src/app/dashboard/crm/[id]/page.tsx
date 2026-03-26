'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface Customer {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthDate: string | null;
  prefecture: string | null;
  membershipTier: string | null;
  messageCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  blockedAt: string | null;
  attributes: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  fullName: string | null;
  fullNameKana: string | null;
  nickname: string | null;
  postalCode: string | null;
  city: string | null;
  occupation: string | null;
  company: string | null;
  ageGroup: string | null;
  acquisitionSource: string | null;
  acquisitionMedium: string | null;
  acquisitionCampaign: string | null;
  engagementScore: number;
  lifecycleStage: string;
  totalPurchaseAmount: number;
  purchaseCount: number;
  lastPurchaseAt: string | null;
  reservationCount: number;
  couponUsageCount: number;
}

interface CustomerTag {
  id: string;
  customerId: string;
  tag: string;
  createdAt: string;
}

interface CustomerAction {
  id: string;
  customerId: string;
  actionType: string;
  actionDetail: Record<string, unknown>;
  source: string | null;
  actedAt: string;
}

interface CustomFieldDefinition {
  id: string;
  name: string;
  fieldKey: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  options: string[];
  isRequired: boolean;
  displayOrder: number;
  description: string | null;
}

interface CustomFieldValue {
  id: string;
  customerId: string;
  fieldId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueJson: unknown;
  valueBoolean: boolean | null;
  definition: CustomFieldDefinition;
}

interface TagCategory {
  id: string;
  name: string;
  color: string;
  displayOrder: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

type TabKey = 'basic' | 'activity' | 'custom' | 'tags';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: '基本情報' },
  { key: 'activity', label: '行動データ' },
  { key: 'custom', label: 'カスタム属性' },
  { key: 'tags', label: 'タグ' },
];

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

const TIER_STYLES: Record<string, string> = {
  free: 'bg-slate-100 text-slate-600 border-slate-300',
  silver: 'bg-blue-100 text-blue-700 border-blue-300',
  gold: 'bg-amber-100 text-amber-700 border-amber-300',
  platinum: 'bg-purple-100 text-purple-700 border-purple-300',
};

const TIER_LABELS: Record<string, string> = {
  free: 'フリー',
  silver: 'シルバー',
  gold: 'ゴールド',
  platinum: 'プラチナ',
};

const LIFECYCLE_STYLES: Record<string, string> = {
  new: 'bg-sky-100 text-sky-700 border-sky-300',
  active: 'bg-green-100 text-green-700 border-green-300',
  engaged: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  loyal: 'bg-violet-100 text-violet-700 border-violet-300',
  at_risk: 'bg-orange-100 text-orange-700 border-orange-300',
  churned: 'bg-red-100 text-red-700 border-red-300',
  inactive: 'bg-slate-100 text-slate-500 border-slate-300',
};

const LIFECYCLE_LABELS: Record<string, string> = {
  new: '新規',
  active: 'アクティブ',
  engaged: 'エンゲージ',
  loyal: 'ロイヤル',
  at_risk: '離脱リスク',
  churned: '離脱',
  inactive: '非アクティブ',
};

const GENDER_OPTIONS = [
  { value: '', label: '未設定' },
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'other', label: 'その他' },
];

const AGE_GROUP_OPTIONS = [
  { value: '', label: '未設定' },
  { value: '10s', label: '10代' },
  { value: '20s', label: '20代' },
  { value: '30s', label: '30代' },
  { value: '40s', label: '40代' },
  { value: '50s', label: '50代' },
  { value: '60s', label: '60代以上' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return '-';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}日前`;
  return formatDate(iso);
}

function calcAge(birthDate: string | null | undefined): string {
  if (!birthDate) return '-';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '-';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age}歳`;
}

function engagementColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green-500
  if (score >= 60) return '#84cc16'; // lime-500
  if (score >= 40) return '#eab308'; // yellow-500
  if (score >= 20) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '¥0';
  return `¥${amount.toLocaleString()}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

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

function EngagementGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  const color = engagementColor(clamped);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-xs font-bold text-slate-700">{clamped}</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CrmCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();

  /* ── state ── */
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [actions, setActions] = useState<CustomerAction[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldValue[]>([]);
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('basic');

  // basic info edit form
  const [editForm, setEditForm] = useState({
    fullName: '',
    fullNameKana: '',
    email: '',
    phone: '',
    gender: '',
    birthDate: '',
    postalCode: '',
    prefecture: '',
    city: '',
    occupation: '',
    company: '',
    ageGroup: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // tag management
  const [newTag, setNewTag] = useState('');
  const [tagLoading, setTagLoading] = useState(false);

  // custom field save states
  const [cfSaving, setCfSaving] = useState<Record<string, boolean>>({});
  const [cfValues, setCfValues] = useState<Record<string, string | number | boolean | null>>({});
  const [cfMsg, setCfMsg] = useState<Record<string, string>>({});

  /* ── fetch helpers ── */

  const fetchCustomer = useCallback(async () => {
    const res = await fetch(`/api/crm/customers/${id}`);
    if (!res.ok) throw new Error('顧客情報の取得に失敗しました');
    return res.json() as Promise<Customer>;
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

  const fetchCustomFields = useCallback(async () => {
    const res = await fetch(`/api/crm/customers/${id}/custom-fields`);
    if (!res.ok) return [];
    return res.json();
  }, [id]);

  const fetchTagCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/tag-categories');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.categories ?? [];
    } catch {
      return [];
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cust, tagData, actionData, cfData, catData] = await Promise.all([
        fetchCustomer(),
        fetchTags(),
        fetchActions(),
        fetchCustomFields(),
        fetchTagCategories(),
      ]);

      setCustomer(cust);

      // Tags: API returns { tags: CustomerTag[] }
      const rawTags = tagData?.tags ?? tagData ?? [];
      setTags(Array.isArray(rawTags) ? rawTags : []);

      // Actions: API returns CustomerAction[] directly
      const rawActions = Array.isArray(actionData) ? actionData : actionData?.actions ?? [];
      setActions(rawActions);

      // Custom fields
      const rawCf = Array.isArray(cfData) ? cfData : cfData?.fields ?? [];
      setCustomFields(rawCf);

      // Initialize custom field local values
      const cfInit: Record<string, string | number | boolean | null> = {};
      for (const cf of rawCf) {
        const def = cf?.definition;
        if (!def) continue;
        if (def.fieldType === 'boolean') cfInit[def.id] = cf.valueBoolean ?? false;
        else if (def.fieldType === 'number') cfInit[def.id] = cf.valueNumber ?? null;
        else if (def.fieldType === 'date') cfInit[def.id] = cf.valueDate ?? '';
        else cfInit[def.id] = cf.valueText ?? '';
      }
      setCfValues(cfInit);

      // Tag categories
      setTagCategories(Array.isArray(catData) ? catData : []);

      // Edit form
      setEditForm({
        fullName: cust?.fullName ?? '',
        fullNameKana: cust?.fullNameKana ?? '',
        email: cust?.email ?? '',
        phone: cust?.phone ?? '',
        gender: cust?.gender ?? '',
        birthDate: cust?.birthDate ?? '',
        postalCode: cust?.postalCode ?? '',
        prefecture: cust?.prefecture ?? '',
        city: cust?.city ?? '',
        occupation: cust?.occupation ?? '',
        company: cust?.company ?? '',
        ageGroup: cust?.ageGroup ?? '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [fetchCustomer, fetchTags, fetchActions, fetchCustomFields, fetchTagCategories]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── profile save ── */

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

  /* ── tag management ── */

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
      const created = await res.json();
      setTags((prev) => [...prev, { id: created?.id ?? tag, customerId: id, tag, createdAt: new Date().toISOString() }]);
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
      setTags((prev) => prev.filter((t) => (typeof t === 'string' ? t : t?.tag) !== tag));
    } catch {
      // silently fail
    } finally {
      setTagLoading(false);
    }
  }

  /* ── custom field save ── */

  async function handleCfSave(fieldId: string, fieldType: string) {
    setCfSaving((p) => ({ ...p, [fieldId]: true }));
    setCfMsg((p) => ({ ...p, [fieldId]: '' }));
    try {
      const val = cfValues[fieldId];
      const body: Record<string, unknown> = { fieldId };
      if (fieldType === 'boolean') body.boolean = val;
      else if (fieldType === 'number') body.number = val != null && val !== '' ? Number(val) : null;
      else if (fieldType === 'date') body.date = val || null;
      else body.text = val ?? '';

      const res = await fetch(`/api/crm/customers/${id}/custom-fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      setCfMsg((p) => ({ ...p, [fieldId]: '保存しました' }));
      setTimeout(() => setCfMsg((p) => ({ ...p, [fieldId]: '' })), 3000);
    } catch (e) {
      setCfMsg((p) => ({ ...p, [fieldId]: e instanceof Error ? e.message : 'エラー' }));
    } finally {
      setCfSaving((p) => ({ ...p, [fieldId]: false }));
    }
  }

  /* ── helpers for tag display ── */

  function getTagName(t: CustomerTag | string): string {
    return typeof t === 'string' ? t : t?.tag ?? '';
  }

  function getTagCategory(_tag: string): TagCategory | undefined {
    // Tag categories are used for grouping; simple name-based match if needed
    // In the current data model, tags don't have a direct category foreign key.
    // We return undefined; categories are displayed as group headers in the tags tab.
    return undefined;
  }

  // Group tags by category for the tags tab
  function groupTagsByCategory(allTags: (CustomerTag | string)[]): { category: TagCategory | null; tags: string[] }[] {
    // Without a direct tag-category relationship, display all tags in one group
    // If tagCategories exist, we check if the tag name starts with "category:" pattern
    const tagNames = allTags.map(getTagName).filter(Boolean);
    if (tagCategories.length === 0) {
      return [{ category: null, tags: tagNames }];
    }
    const groups: { category: TagCategory | null; tags: string[] }[] = tagCategories.map((cat) => ({
      category: cat,
      tags: [],
    }));
    const uncategorized: string[] = [];
    for (const name of tagNames) {
      // Check if any category name is a prefix
      const matched = tagCategories.find((cat) => name.startsWith(`${cat.name}:`));
      if (matched) {
        const group = groups.find((g) => g.category?.id === matched.id);
        if (group) group.tags.push(name);
        else uncategorized.push(name);
      } else {
        uncategorized.push(name);
      }
    }
    if (uncategorized.length > 0) {
      groups.push({ category: null, tags: uncategorized });
    }
    return groups.filter((g) => g.tags.length > 0);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════════════ */

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

  const tierKey = customer.membershipTier ?? 'free';
  const tierClass = TIER_STYLES[tierKey] ?? TIER_STYLES.free;
  const tierLabel = TIER_LABELS[tierKey] ?? tierKey;
  const stageKey = customer.lifecycleStage ?? 'new';
  const stageClass = LIFECYCLE_STYLES[stageKey] ?? LIFECYCLE_STYLES.new;
  const stageLabel = LIFECYCLE_LABELS[stageKey] ?? stageKey;

  // Compact tags for header (max 5)
  const headerTags = tags.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <Link href="/dashboard/crm" className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        顧客一覧に戻る
      </Link>

      {/* ════════════════════════════════════════════════════════════════════════
         Header Card (always visible)
         ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-5 flex-wrap sm:flex-nowrap">
          {/* Avatar */}
          {customer.pictureUrl ? (
            <img
              src={customer.pictureUrl}
              alt={customer.displayName ?? ''}
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 grid place-items-center text-white text-xl font-bold shrink-0">
              {customer.displayName?.charAt(0) ?? '?'}
            </div>
          )}

          {/* Name / LINE ID / Badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800 truncate">{customer.displayName ?? '名前なし'}</h1>
              {/* Lifecycle badge */}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${stageClass}`}>
                {stageLabel}
              </span>
              {/* Tier badge */}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tierClass}`}>
                {tierLabel}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5 truncate">LINE ID: {customer.lineUserId ?? '-'}</p>

            {/* Compact tags */}
            {headerTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {headerTags.map((t) => {
                  const name = getTagName(t);
                  const cat = getTagCategory(name);
                  return (
                    <span
                      key={name}
                      className={cat ? 'px-2 py-0.5 rounded-full text-[10px] font-medium border' : 'px-2 py-0.5 rounded-full text-[10px] font-medium border bg-green-50 text-green-700 border-green-200'}
                      style={cat ? { backgroundColor: `${cat.color}20`, color: cat.color, borderColor: `${cat.color}40` } : undefined}
                    >
                      {name}
                    </span>
                  );
                })}
                {tags.length > 5 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                    +{tags.length - 5}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Engagement gauge */}
          <div className="shrink-0 flex flex-col items-center">
            <EngagementGauge score={customer.engagementScore ?? 0} />
            <span className="text-[10px] text-slate-400 mt-1">エンゲージメント</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
         Tab Navigation
         ════════════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
         Tab Content
         ════════════════════════════════════════════════════════════════════════ */}

      {/* ─── 基本情報 Tab ─── */}
      {activeTab === 'basic' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-5">個人情報</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">氏名</span>
              <input
                type="text"
                value={editForm.fullName}
                onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                placeholder="山田太郎"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">氏名（カナ）</span>
              <input
                type="text"
                value={editForm.fullNameKana}
                onChange={(e) => setEditForm((f) => ({ ...f, fullNameKana: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                placeholder="ヤマダタロウ"
              />
            </label>
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
              <span className="text-xs font-medium text-slate-500">
                生年月日
                {customer.birthDate && (
                  <span className="ml-2 text-slate-400 font-normal">({calcAge(customer.birthDate)})</span>
                )}
              </span>
              <input
                type="date"
                value={editForm.birthDate}
                onChange={(e) => setEditForm((f) => ({ ...f, birthDate: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">年齢層</span>
              <select
                value={editForm.ageGroup}
                onChange={(e) => setEditForm((f) => ({ ...f, ageGroup: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition bg-white"
              >
                {AGE_GROUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">郵便番号</span>
              <input
                type="text"
                value={editForm.postalCode}
                onChange={(e) => setEditForm((f) => ({ ...f, postalCode: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                placeholder="100-0001"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">都道府県</span>
              <input
                type="text"
                value={editForm.prefecture}
                onChange={(e) => setEditForm((f) => ({ ...f, prefecture: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                placeholder="東京都"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">市区町村</span>
              <input
                type="text"
                value={editForm.city}
                onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                placeholder="千代田区"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">職業</span>
              <input
                type="text"
                value={editForm.occupation}
                onChange={(e) => setEditForm((f) => ({ ...f, occupation: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                placeholder="エンジニア"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">会社名</span>
              <input
                type="text"
                value={editForm.company}
                onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                placeholder="株式会社○○"
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
      )}

      {/* ─── 行動データ Tab ─── */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="エンゲージメント" value={customer.engagementScore ?? 0} sub="/100" />
            <StatCard label="メッセージ数" value={customer.messageCount ?? 0} />
            <StatCard label="累計購入金額" value={formatCurrency(customer.totalPurchaseAmount)} />
            <StatCard label="購入回数" value={customer.purchaseCount ?? 0} sub={customer.lastPurchaseAt ? `最終: ${formatDate(customer.lastPurchaseAt)}` : undefined} />
            <StatCard label="予約回数" value={customer.reservationCount ?? 0} />
            <StatCard label="クーポン利用" value={customer.couponUsageCount ?? 0} />
          </div>

          {/* Acquisition info */}
          {(customer.acquisitionSource || customer.acquisitionMedium || customer.acquisitionCampaign) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">獲得チャネル</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">ソース</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{customer.acquisitionSource ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">メディア</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{customer.acquisitionMedium ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">キャンペーン</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{customer.acquisitionCampaign ?? '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Activity timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">アクティビティ</h2>
            {actions.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">アクティビティはまだありません</p>
            ) : (
              <div className="space-y-0">
                {actions.map((a, i) => {
                  const aType = a?.actionType ?? '';
                  const iconPath = ACTION_ICONS[aType] ?? ACTION_ICONS.page_view;
                  const label = ACTION_LABELS[aType] ?? aType;
                  const detail = a?.actionDetail;
                  const detailStr = detail && typeof detail === 'object' && Object.keys(detail).length > 0
                    ? (detail.description as string) ?? (detail.detail as string) ?? JSON.stringify(detail)
                    : null;
                  return (
                    <div key={a?.id ?? i} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < actions.length - 1 && (
                        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />
                      )}
                      <div className="relative z-10 w-8 h-8 rounded-full bg-slate-100 grid place-items-center shrink-0">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                        </svg>
                      </div>
                      <div className="pt-0.5 min-w-0">
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">{label}</span>
                          {detailStr && <span className="text-slate-500"> &mdash; {detailStr}</span>}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{relativeTime(a?.actedAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── カスタム属性 Tab ─── */}
      {activeTab === 'custom' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-5">カスタム属性</h2>
          {customFields.length === 0 ? (
            <div className="text-center py-10">
              <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-sm text-slate-400">カスタム属性は定義されていません</p>
              <p className="text-xs text-slate-400 mt-1">管理画面のCRM設定からカスタム属性を追加できます</p>
            </div>
          ) : (
            <div className="space-y-5">
              {customFields.map((cf) => {
                const def = cf?.definition;
                if (!def) return null;
                const fieldId = def.id;
                const isSaving = cfSaving[fieldId] ?? false;
                const msg = cfMsg[fieldId] ?? '';
                const localVal = cfValues[fieldId];

                return (
                  <div key={fieldId} className="flex flex-col sm:flex-row sm:items-end gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <label className="block">
                        <span className="text-xs font-medium text-slate-500">
                          {def.name}
                          {def.isRequired && <span className="text-red-400 ml-0.5">*</span>}
                        </span>
                        {def.description && (
                          <span className="text-[10px] text-slate-400 ml-2">{def.description}</span>
                        )}

                        {/* text */}
                        {def.fieldType === 'text' && (
                          <input
                            type="text"
                            value={(localVal as string) ?? ''}
                            onChange={(e) => setCfValues((p) => ({ ...p, [fieldId]: e.target.value }))}
                            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                          />
                        )}

                        {/* number */}
                        {def.fieldType === 'number' && (
                          <input
                            type="number"
                            value={localVal != null ? String(localVal) : ''}
                            onChange={(e) => setCfValues((p) => ({ ...p, [fieldId]: e.target.value === '' ? null : Number(e.target.value) }))}
                            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                          />
                        )}

                        {/* date */}
                        {def.fieldType === 'date' && (
                          <input
                            type="date"
                            value={(localVal as string) ?? ''}
                            onChange={(e) => setCfValues((p) => ({ ...p, [fieldId]: e.target.value }))}
                            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
                          />
                        )}

                        {/* select */}
                        {(def.fieldType === 'select' || def.fieldType === 'multiselect') && (
                          <select
                            value={(localVal as string) ?? ''}
                            onChange={(e) => setCfValues((p) => ({ ...p, [fieldId]: e.target.value }))}
                            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition bg-white"
                          >
                            <option value="">選択してください</option>
                            {(def.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {/* boolean */}
                        {def.fieldType === 'boolean' && (
                          <div className="mt-2">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(localVal)}
                                onChange={(e) => setCfValues((p) => ({ ...p, [fieldId]: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-400"
                              />
                              <span className="text-sm text-slate-600">有効</span>
                            </label>
                          </div>
                        )}
                      </label>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCfSave(fieldId, def.fieldType)}
                        disabled={isSaving}
                        className="px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? '保存中...' : '保存'}
                      </button>
                      {msg && (
                        <span className={`text-xs font-medium ${msg === '保存しました' ? 'text-green-600' : 'text-red-600'}`}>
                          {msg}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── タグ Tab ─── */}
      {activeTab === 'tags' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">タグ管理</h2>

          {/* Add tag form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTag();
            }}
            className="flex gap-2 mb-6"
          >
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="新しいタグを入力"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition"
            />
            <button
              type="submit"
              disabled={tagLoading || !newTag.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              追加
            </button>
          </form>

          {/* Tags grouped by category */}
          {tags.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">タグはまだありません</p>
          ) : (
            <div className="space-y-5">
              {groupTagsByCategory(tags).map((group, gi) => (
                <div key={group.category?.id ?? `uncategorized-${gi}`}>
                  {/* Category header */}
                  {group.category ? (
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: group.category.color }}
                      />
                      <span className="text-xs font-semibold text-slate-600">{group.category.name}</span>
                    </div>
                  ) : tagCategories.length > 0 ? (
                    <p className="text-xs font-semibold text-slate-500 mb-2">その他</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((tagName) => (
                      <span
                        key={tagName}
                        className={group.category ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border' : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200'}
                        style={
                          group.category
                            ? { backgroundColor: `${group.category.color}15`, color: group.category.color, borderColor: `${group.category.color}30` }
                            : undefined
                        }
                      >
                        {tagName}
                        <button
                          onClick={() => handleRemoveTag(tagName)}
                          disabled={tagLoading}
                          className="ml-0.5 hover:text-red-500 transition-colors disabled:opacity-50"
                          aria-label={`${tagName}を削除`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
