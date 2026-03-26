'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ─── types ─── */
interface BusinessHours {
  [day: string]: { start: string; end: string };
}

interface BookingSettings {
  businessHours: BusinessHours;
  slotDurations: number[];
  bufferMinutes: number;
  maxAdvanceDays: number;
  holidays: string[];
}

interface Consultant {
  id: string;
  name: string;
  email: string;
  meetUrl: string;
  specialties: string[];
  active: boolean;
}

const DAY_LABELS: Record<string, string> = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
};

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: { start: '09:00', end: '18:00' },
  tue: { start: '09:00', end: '18:00' },
  wed: { start: '09:00', end: '18:00' },
  thu: { start: '09:00', end: '18:00' },
  fri: { start: '09:00', end: '18:00' },
};

const DEFAULT_SETTINGS: BookingSettings = {
  businessHours: DEFAULT_BUSINESS_HOURS,
  slotDurations: [30],
  bufferMinutes: 10,
  maxAdvanceDays: 14,
  holidays: [],
};

/* ─── tiny helpers ─── */
const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const inputCls =
  'px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';

const btnPrimary =
  'py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors';

/* ════════════════════════════════════════════════════════════════ */
export default function SlotsSettingsPage() {
  const pathname = usePathname();
  const subNav = [
    { label: '予約一覧', href: '/dashboard/reservations' },
    { label: 'カレンダー', href: '/dashboard/reservations/calendar' },
    { label: 'スロット設定', href: '/dashboard/reservations/slots' },
  ];

  /* ─── booking settings state ─── */
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_SETTINGS);
  const [newClosedDate, setNewClosedDate] = useState('');
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  /* ─── consultants state ─── */
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [consultantForm, setConsultantForm] = useState({ name: '', email: '', meetUrl: '', specialties: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [consultantMsg, setConsultantMsg] = useState<string | null>(null);
  const [savingConsultant, setSavingConsultant] = useState(false);

  /* ─── slot generation state ─── */
  const [genConsultantId, setGenConsultantId] = useState('');
  const [genFrom, setGenFrom] = useState('');
  const [genTo, setGenTo] = useState('');
  const [genDuration, setGenDuration] = useState(30);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  /* ─── fetch on mount ─── */
  const fetchSettings = useCallback(() => {
    fetch('/api/booking/settings')
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => { if (d && d.businessHours) setSettings(d); })
      .catch(() => {});
  }, []);

  const fetchConsultants = useCallback(() => {
    fetch('/api/booking/consultants')
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => { if (Array.isArray(d)) setConsultants(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchConsultants();
  }, [fetchSettings, fetchConsultants]);

  /* ─── settings handlers ─── */
  const updateHour = (day: string, field: 'start' | 'end', value: string) => {
    setSettings((p) => ({
      ...p,
      businessHours: {
        ...p.businessHours,
        [day]: { ...p.businessHours[day], [field]: value },
      },
    }));
  };

  const toggleDuration = (d: number) => {
    setSettings((p) => ({
      ...p,
      slotDurations: p.slotDurations.includes(d)
        ? p.slotDurations.filter((x) => x !== d)
        : [...p.slotDurations, d].sort(),
    }));
  };

  const addClosedDate = () => {
    if (!newClosedDate || settings.holidays.includes(newClosedDate)) return;
    setSettings((p) => ({ ...p, holidays: [...p.holidays, newClosedDate].sort() }));
    setNewClosedDate('');
  };

  const removeClosedDate = (date: string) => {
    setSettings((p) => ({ ...p, holidays: p.holidays.filter((d) => d !== date) }));
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const r = await fetch('/api/booking/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error ?? '保存に失敗しました');
      }
      setSettingsMsg('OK:設定を保存しました');
    } catch (e) {
      setSettingsMsg('ERR:' + (e instanceof Error ? e.message : 'エラーが発生しました'));
    } finally {
      setSavingSettings(false);
    }
  };

  /* ─── consultant handlers ─── */
  const resetConsultantForm = () => {
    setConsultantForm({ name: '', email: '', meetUrl: '', specialties: '' });
    setEditingId(null);
  };

  const startEdit = (c: Consultant) => {
    setEditingId(c.id);
    setConsultantForm({
      name: c.name,
      email: c.email,
      meetUrl: c.meetUrl,
      specialties: c.specialties.join(', '),
    });
  };

  const saveConsultant = async () => {
    setSavingConsultant(true);
    setConsultantMsg(null);
    const payload = {
      ...consultantForm,
      specialties: consultantForm.specialties.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      const url = editingId ? `/api/booking/consultants/${editingId}` : '/api/booking/consultants';
      const method = editingId ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error ?? '保存に失敗しました');
      }
      setConsultantMsg('OK:' + (editingId ? '相談員を更新しました' : '相談員を追加しました'));
      resetConsultantForm();
      fetchConsultants();
    } catch (e) {
      setConsultantMsg('ERR:' + (e instanceof Error ? e.message : 'エラーが発生しました'));
    } finally {
      setSavingConsultant(false);
    }
  };

  const deleteConsultant = async (id: string) => {
    if (!confirm('この相談員を削除しますか？')) return;
    try {
      const r = await fetch(`/api/booking/consultants/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error ?? '削除に失敗しました');
      }
      setConsultantMsg('OK:相談員を削除しました');
      fetchConsultants();
    } catch (e) {
      setConsultantMsg('ERR:' + (e instanceof Error ? e.message : 'エラーが発生しました'));
    }
  };

  /* ─── slot generation handler ─── */
  const generateSlots = async () => {
    setGenerating(true);
    setGenMsg(null);
    try {
      const r = await fetch('/api/booking/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultantId: genConsultantId,
          from: genFrom,
          to: genTo,
          duration: genDuration,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error ?? '生成に失敗しました');
      }
      const d = await r.json().catch(() => ({}));
      setGenMsg(`OK:${d?.count ?? 0}件のスロットを生成しました`);
    } catch (e) {
      setGenMsg('ERR:' + (e instanceof Error ? e.message : 'エラーが発生しました'));
    } finally {
      setGenerating(false);
    }
  };

  /* ────────────────────────── render ────────────────────────── */
  return (
    <div className="space-y-8">
      {/* Sub-navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 pb-3">
        {subNav.map((item) => {
          const active = item.href === '/dashboard/reservations'
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

      {/* header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">スロット設定</h1>
        <p className="text-sm text-slate-400 mt-1">予約枠の生成に必要な設定を管理します</p>
      </div>

      {/* ──────────── 1. 予約設定 ──────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">予約設定</h2>
          <p className="text-xs text-slate-400 mt-0.5">営業時間やスロット条件を設定</p>
        </div>

        <div className="p-5 space-y-6">
          {/* 営業時間 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">営業時間</label>
            <div className="space-y-2">
              {DAY_ORDER.map((day) => {
                const hours = settings.businessHours[day];
                if (!hours) return null;
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-16 text-sm text-slate-600">{DAY_LABELS[day]}</span>
                    <input
                      type="time"
                      value={hours.start}
                      onChange={(e) => updateHour(day, 'start', e.target.value)}
                      className={inputCls}
                    />
                    <span className="text-sm text-slate-400">〜</span>
                    <input
                      type="time"
                      value={hours.end}
                      onChange={(e) => updateHour(day, 'end', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* スロット時間 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">スロット時間</label>
            <div className="flex items-center gap-4">
              {[30, 60].map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.slotDurations.includes(d)}
                    onChange={() => toggleDuration(d)}
                    className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                  {d}分
                </label>
              ))}
            </div>
          </div>

          {/* バッファ時間 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">バッファ時間（分）</label>
            <input
              type="number"
              min={0}
              value={settings.bufferMinutes}
              onChange={(e) => setSettings((p) => ({ ...p, bufferMinutes: parseInt(e.target.value) || 0 }))}
              className={`${inputCls} w-24`}
            />
          </div>

          {/* 予約可能期間 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">予約可能期間（日先まで）</label>
            <input
              type="number"
              min={1}
              value={settings.maxAdvanceDays}
              onChange={(e) => setSettings((p) => ({ ...p, maxAdvanceDays: parseInt(e.target.value) || 1 }))}
              className={`${inputCls} w-24`}
            />
          </div>

          {/* 休業日管理 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">休業日管理</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newClosedDate}
                onChange={(e) => setNewClosedDate(e.target.value)}
                className={inputCls}
              />
              <button
                onClick={addClosedDate}
                className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                追加
              </button>
            </div>
            {settings.holidays.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {settings.holidays.map((date) => (
                  <span
                    key={date}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded-full border border-red-200"
                  >
                    {date}
                    <button onClick={() => removeClosedDate(date)} className="hover:text-red-900">
                      <XIcon />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* save */}
          {settingsMsg && (
            <div className={`px-4 py-3 rounded-lg text-sm ${settingsMsg.startsWith('OK:') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {settingsMsg.replace(/^(OK:|ERR:)/, '')}
            </div>
          )}
          <button onClick={saveSettings} disabled={savingSettings} className={`${btnPrimary} w-full`}>
            {savingSettings ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </div>

      {/* ──────────── 2. 相談員管理 ──────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">相談員管理</h2>
          <p className="text-xs text-slate-400 mt-0.5">予約対応する相談員を管理</p>
        </div>

        <div className="p-5 space-y-5">
          {/* consultant list */}
          {consultants.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {consultants.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{c.name}</span>
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          c.active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.active ? '有効' : '無効'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{c.email}</p>
                    <p className="text-xs text-slate-400 truncate">{c.meetUrl}</p>
                    {c.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.specialties.map((s) => (
                          <span key={s} className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded-full">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => startEdit(c)}
                      className="px-2.5 py-1 text-xs text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => deleteConsultant(c.id)}
                      className="px-2.5 py-1 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* add/edit form */}
          <div className="space-y-3 bg-slate-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-600">
              {editingId ? '相談員を編集' : '新しい相談員を追加'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="名前"
                value={consultantForm.name}
                onChange={(e) => setConsultantForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls + ' w-full'}
              />
              <input
                type="email"
                placeholder="メールアドレス"
                value={consultantForm.email}
                onChange={(e) => setConsultantForm((p) => ({ ...p, email: e.target.value }))}
                className={inputCls + ' w-full'}
              />
              <input
                type="url"
                placeholder="Google Meet URL"
                value={consultantForm.meetUrl}
                onChange={(e) => setConsultantForm((p) => ({ ...p, meetUrl: e.target.value }))}
                className={inputCls + ' w-full'}
              />
              <input
                type="text"
                placeholder="専門分野（カンマ区切り）"
                value={consultantForm.specialties}
                onChange={(e) => setConsultantForm((p) => ({ ...p, specialties: e.target.value }))}
                className={inputCls + ' w-full'}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveConsultant}
                disabled={savingConsultant || !consultantForm.name || !consultantForm.email}
                className={`${btnPrimary} px-5`}
              >
                {savingConsultant ? '保存中...' : editingId ? '更新' : '追加'}
              </button>
              {editingId && (
                <button
                  onClick={resetConsultantForm}
                  className="px-4 py-2.5 text-sm text-slate-600 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  キャンセル
                </button>
              )}
            </div>
          </div>

          {consultantMsg && (
            <div className={`px-4 py-3 rounded-lg text-sm ${consultantMsg.startsWith('OK:') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {consultantMsg.replace(/^(OK:|ERR:)/, '')}
            </div>
          )}
        </div>
      </div>

      {/* ──────────── 3. スロット生成 ──────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">スロット生成</h2>
          <p className="text-xs text-slate-400 mt-0.5">相談員の予約枠を一括生成</p>
        </div>

        <div className="p-5 space-y-5">
          {/* consultant select */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">相談員</label>
            <select
              value={genConsultantId}
              onChange={(e) => setGenConsultantId(e.target.value)}
              className={`${inputCls} w-full`}
            >
              <option value="">選択してください</option>
              {consultants
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          {/* date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">開始日</label>
              <input
                type="date"
                value={genFrom}
                onChange={(e) => setGenFrom(e.target.value)}
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">終了日</label>
              <input
                type="date"
                value={genTo}
                onChange={(e) => setGenTo(e.target.value)}
                className={`${inputCls} w-full`}
              />
            </div>
          </div>

          {/* duration */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">スロット時間</label>
            <div className="flex items-center gap-4">
              {[30, 60].map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="genDuration"
                    checked={genDuration === d}
                    onChange={() => setGenDuration(d)}
                    className="h-4 w-4 border-slate-300 text-green-600 focus:ring-green-500"
                  />
                  {d}分
                </label>
              ))}
            </div>
          </div>

          {/* generate */}
          {genMsg && (
            <div className={`px-4 py-3 rounded-lg text-sm ${genMsg.startsWith('OK:') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {genMsg.replace(/^(OK:|ERR:)/, '')}
            </div>
          )}
          <button
            onClick={generateSlots}
            disabled={generating || !genConsultantId || !genFrom || !genTo}
            className={`${btnPrimary} w-full`}
          >
            {generating ? '生成中...' : 'スロットを生成'}
          </button>
        </div>
      </div>
    </div>
  );
}
