'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DiscountType = 'fixed' | 'percentage' | 'free_shipping';

interface FormData {
  code: string;
  name: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number | '';
  min_purchase_amount: number | '';
  max_issues: number | '';
  max_uses_per_customer: number | '';
  valid_from: string;
  valid_until: string;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function NewCouponPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormData>({
    code: '',
    name: '',
    description: '',
    discount_type: 'fixed',
    discount_value: '',
    min_purchase_amount: 0,
    max_issues: '',
    max_uses_per_customer: 1,
    valid_from: '',
    valid_until: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear field error on change
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!form.code.trim()) {
      errors.code = 'クーポンコードは必須です';
    }
    if (!form.name.trim()) {
      errors.name = 'クーポン名は必須です';
    }
    if (form.discount_type !== 'free_shipping') {
      if (form.discount_value === '' || Number(form.discount_value) <= 0) {
        errors.discount_value = '割引額は0より大きい値を入力してください';
      }
      if (form.discount_type === 'percentage' && Number(form.discount_value) > 100) {
        errors.discount_value = '割引率は100以下にしてください';
      }
    }
    if (!form.valid_from) {
      errors.valid_from = '有効開始日時は必須です';
    }
    if (!form.valid_until) {
      errors.valid_until = '有効終了日時は必須です';
    }
    if (form.valid_from && form.valid_until && form.valid_until <= form.valid_from) {
      errors.valid_until = '有効終了日時は開始日時より後にしてください';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const body = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: form.discount_type === 'free_shipping' ? 0 : Number(form.discount_value),
        min_purchase_amount: form.min_purchase_amount === '' ? 0 : Number(form.min_purchase_amount),
        max_issues: form.max_issues === '' ? null : Number(form.max_issues),
        max_uses_per_customer: form.max_uses_per_customer === '' ? 1 : Number(form.max_uses_per_customer),
        valid_from: form.valid_from,
        valid_until: form.valid_until,
      };

      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'クーポンの作成に失敗しました');
      }

      router.push('/dashboard/coupons');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const discountLabel =
    form.discount_type === 'fixed'
      ? '割引額 (円)'
      : form.discount_type === 'percentage'
        ? '割引率 (%)'
        : '';

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/coupons"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        クーポン一覧
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">クーポン作成</h1>
        <p className="text-sm text-slate-400 mt-1">新しいクーポンマスターを登録します</p>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 space-y-5">
          {/* クーポンコード */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              クーポンコード <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setField('code', e.target.value.toUpperCase())}
              placeholder="例: WELCOME2024"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 uppercase ${
                fieldErrors.code ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {fieldErrors.code && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.code}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">半角英数字で入力（自動的に大文字に変換されます）</p>
          </div>

          {/* クーポン名 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              クーポン名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="例: 初回購入500円OFF"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${
                fieldErrors.name ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>
            )}
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">説明</label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              placeholder="クーポンの説明（任意）"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none"
            />
          </div>

          {/* 割引タイプ */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              割引タイプ <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-4">
              {([
                { value: 'fixed', label: '固定額割引' },
                { value: 'percentage', label: 'パーセント割引' },
                { value: 'free_shipping', label: '送料無料' },
              ] as const).map((option) => (
                <label
                  key={option.value}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    form.discount_type === option.value
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="discount_type"
                    value={option.value}
                    checked={form.discount_type === option.value}
                    onChange={(e) => setField('discount_type', e.target.value as DiscountType)}
                    className="w-4 h-4 text-green-600 border-slate-300 focus:ring-green-500/20"
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 割引額 / 割引率 */}
          {form.discount_type !== 'free_shipping' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {discountLabel} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step={form.discount_type === 'percentage' ? '1' : '1'}
                value={form.discount_value}
                onChange={(e) =>
                  setField('discount_value', e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder={form.discount_type === 'fixed' ? '例: 500' : '例: 10'}
                className={`w-full max-w-xs px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${
                  fieldErrors.discount_value ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              {fieldErrors.discount_value && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.discount_value}</p>
              )}
            </div>
          )}

          {/* 最低購入金額 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">最低購入金額 (円)</label>
            <input
              type="number"
              min="0"
              value={form.min_purchase_amount}
              onChange={(e) =>
                setField('min_purchase_amount', e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="0"
              className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
            <p className="mt-1 text-xs text-slate-400">0の場合は制限なし</p>
          </div>

          {/* 最大発行数 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">最大発行数</label>
            <input
              type="number"
              min="1"
              value={form.max_issues}
              onChange={(e) =>
                setField('max_issues', e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="無制限"
              className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
            <p className="mt-1 text-xs text-slate-400">空欄の場合は無制限</p>
          </div>

          {/* 顧客あたり最大利用回数 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">顧客あたり最大利用回数</label>
            <input
              type="number"
              min="1"
              value={form.max_uses_per_customer}
              onChange={(e) =>
                setField('max_uses_per_customer', e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="1"
              className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>

          {/* 有効開始日時 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                有効開始日時 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.valid_from}
                onChange={(e) => setField('valid_from', e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${
                  fieldErrors.valid_from ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              {fieldErrors.valid_from && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.valid_from}</p>
              )}
            </div>

            {/* 有効終了日時 */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                有効終了日時 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.valid_until}
                onChange={(e) => setField('valid_until', e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${
                  fieldErrors.valid_until ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              {fieldErrors.valid_until && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.valid_until}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            href="/dashboard/coupons"
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                作成中...
              </span>
            ) : (
              'クーポンを作成'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
