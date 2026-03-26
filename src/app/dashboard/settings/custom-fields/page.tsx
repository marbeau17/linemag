'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomField {
  id: string;
  name: string;
  key: string;
  type: FieldType;
  options: string[] | null;
  required: boolean;
  description: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

type FieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';

interface FieldFormData {
  name: string;
  key: string;
  type: FieldType;
  options: string;
  required: boolean;
  description: string;
  displayOrder: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'テキスト' },
  { value: 'number', label: '数値' },
  { value: 'date', label: '日付' },
  { value: 'select', label: '選択' },
  { value: 'multiselect', label: '複数選択' },
  { value: 'checkbox', label: 'チェックボックス' },
];

const FIELD_TYPE_STYLES: Record<FieldType, string> = {
  text: 'bg-blue-100 text-blue-700',
  number: 'bg-purple-100 text-purple-700',
  date: 'bg-amber-100 text-amber-700',
  select: 'bg-green-100 text-green-700',
  multiselect: 'bg-teal-100 text-teal-700',
  checkbox: 'bg-slate-100 text-slate-600',
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'テキスト',
  number: '数値',
  date: '日付',
  select: '選択',
  multiselect: '複数選択',
  checkbox: 'チェックボックス',
};

const EMPTY_FORM: FieldFormData = {
  name: '',
  key: '',
  type: 'text',
  options: '',
  required: false,
  description: '',
  displayOrder: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Japanese / arbitrary text into a safe field key (alphanumeric + underscore). */
function toFieldKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomFieldsPage() {
  // List state
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FieldFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CustomField | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/custom-fields');
      if (!res.ok) throw new Error('カスタムフィールドの取得に失敗しました');
      const data = await res.json();
      setFields(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  // ---------------------------------------------------------------------------
  // Modal helpers
  // ---------------------------------------------------------------------------

  function openCreateModal() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, displayOrder: fields.length + 1 });
    setKeyManuallyEdited(false);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(field: CustomField) {
    setEditingId(field.id);
    setForm({
      name: field.name,
      key: field.key,
      type: field.type,
      options: field.options?.join(', ') ?? '',
      required: field.required,
      description: field.description ?? '',
      displayOrder: field.displayOrder,
    });
    setKeyManuallyEdited(true);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  // ---------------------------------------------------------------------------
  // Save (create / update)
  // ---------------------------------------------------------------------------

  async function handleSave() {
    // Validation
    if (!form.name.trim()) {
      setFormError('フィールド名を入力してください');
      return;
    }
    if (!form.key.trim()) {
      setFormError('フィールドキーを入力してください');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(form.key)) {
      setFormError('フィールドキーは半角英数字とアンダースコアのみ使用できます');
      return;
    }
    if ((form.type === 'select' || form.type === 'multiselect') && !form.options.trim()) {
      setFormError('選択タイプの場合、選択肢を入力してください');
      return;
    }

    setSaving(true);
    setFormError(null);

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      key: form.key.trim(),
      type: form.type,
      required: form.required,
      description: form.description.trim() || null,
      displayOrder: form.displayOrder,
      options:
        form.type === 'select' || form.type === 'multiselect'
          ? form.options
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : null,
    };

    try {
      const url = editingId
        ? `/api/crm/custom-fields/${editingId}`
        : '/api/crm/custom-fields';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? '保存に失敗しました');
      }

      closeModal();
      await fetchFields();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/crm/custom-fields/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('削除に失敗しました');
      setDeleteTarget(null);
      await fetchFields();
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Reorder helpers
  // ---------------------------------------------------------------------------

  async function moveField(id: string, direction: 'up' | 'down') {
    const sorted = [...fields].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const current = sorted[idx];
    const target = sorted[swapIdx];

    // Swap display orders
    try {
      await Promise.all([
        fetch(`/api/crm/custom-fields/${current.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayOrder: target.displayOrder }),
        }),
        fetch(`/api/crm/custom-fields/${target.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayOrder: current.displayOrder }),
        }),
      ]);
      await fetchFields();
    } catch {
      setError('並び替えに失敗しました');
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const sortedFields = [...fields].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">カスタムフィールド管理</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? '読み込み中...' : `${fields.length}件のカスタムフィールド`}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新規作成
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
                  順序
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  フィールド名
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  キー
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  タイプ
                </th>
                <th className="text-center px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  必須
                </th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  説明
                </th>
                <th className="text-center px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && fields.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-400">
                    <svg
                      className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-300"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    読み込み中...
                  </td>
                </tr>
              ) : fields.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-400">
                    カスタムフィールドがまだ登録されていません。「新規作成」ボタンから作成してください。
                  </td>
                </tr>
              ) : (
                sortedFields.map((field, idx) => (
                  <tr
                    key={field.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Order arrows */}
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex flex-col gap-0.5">
                        <button
                          onClick={() => moveField(field.id, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="上に移動"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveField(field.id, 'down')}
                          disabled={idx === sortedFields.length - 1}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="下に移動"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">
                      {field.name}
                    </td>

                    {/* Key */}
                    <td className="px-5 py-3">
                      <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {field.key}
                      </code>
                    </td>

                    {/* Type badge */}
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          FIELD_TYPE_STYLES[field.type] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {FIELD_TYPE_LABELS[field.type] ?? field.type}
                      </span>
                    </td>

                    {/* Required */}
                    <td className="px-5 py-3 text-center">
                      {field.required ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          必須
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-5 py-3 text-xs text-slate-500 max-w-[200px] truncate">
                      {field.description || '-'}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(field)}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => setDeleteTarget(field)}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Create / Edit Modal                                                   */}
      {/* ===================================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeModal}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-800">
                {editingId ? 'カスタムフィールドを編集' : 'カスタムフィールドを作成'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                  {formError}
                </div>
              )}

              {/* フィールド名 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  フィールド名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      name,
                      key: keyManuallyEdited ? prev.key : toFieldKey(name),
                    }));
                  }}
                  placeholder="例: 誕生日"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
                />
              </div>

              {/* フィールドキー */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  フィールドキー <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.key}
                  onChange={(e) => {
                    setKeyManuallyEdited(true);
                    setForm((prev) => ({ ...prev, key: e.target.value }));
                  }}
                  placeholder="例: birthday"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  半角英数字とアンダースコアのみ。名前から自動生成されます。
                </p>
              </div>

              {/* フィールドタイプ */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  フィールドタイプ <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, type: e.target.value as FieldType }))
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
                >
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 選択肢 (select / multiselect only) */}
              {(form.type === 'select' || form.type === 'multiselect') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    選択肢 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.options}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, options: e.target.value }))
                    }
                    placeholder="例: 選択肢A, 選択肢B, 選択肢C"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    カンマ区切りで入力してください。
                  </p>
                </div>
              )}

              {/* 必須フラグ */}
              <div className="flex items-center gap-2">
                <input
                  id="field-required"
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, required: e.target.checked }))
                  }
                  className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500/30"
                />
                <label htmlFor="field-required" className="text-sm font-medium text-slate-700">
                  必須フィールドにする
                </label>
              </div>

              {/* 説明 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  説明
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  placeholder="このフィールドの用途や入力規則の説明"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors resize-none"
                />
              </div>

              {/* 表示順 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  表示順
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      displayOrder: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-24 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors tabular-nums"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {saving && (
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                {editingId ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Delete Confirmation Modal                                             */}
      {/* ===================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteTarget(null)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-xl">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 grid place-items-center shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">フィールドを削除</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    「{deleteTarget.name}」を削除しますか？この操作は取り消せません。
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {deleting && (
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
