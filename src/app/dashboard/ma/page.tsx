'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TriggerType = 'event' | 'schedule' | 'manual';

type StepType = 'wait' | 'message' | 'condition' | 'coupon' | 'tag';

interface ScenarioStep {
  id: string;
  type: StepType;
  order: number;
  config: Record<string, unknown>;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  targetSegmentId?: string;
  isActive: boolean;
  steps: ScenarioStep[];
  stats?: {
    sent: number;
    opened: number;
    clicked: number;
  };
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Segment {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_LABELS: Record<TriggerType, string> = {
  event: 'イベント',
  schedule: 'スケジュール',
  manual: '手動',
};

const TRIGGER_BADGE_STYLES: Record<TriggerType, string> = {
  event: 'bg-blue-100 text-blue-700',
  schedule: 'bg-purple-100 text-purple-700',
  manual: 'bg-amber-100 text-amber-700',
};

const EVENT_TYPES = [
  { value: 'friend_added', label: '友だち追加' },
  { value: 'product_purchased', label: '商品購入' },
  { value: 'reservation_completed', label: '予約完了' },
  { value: 'birthday', label: '誕生日' },
  { value: 'inactive_30days', label: '30日間未活動' },
];

const STEP_TYPE_LABELS: Record<StepType, string> = {
  wait: '待機',
  message: 'メッセージ送信',
  condition: '条件分岐',
  coupon: 'クーポン配布',
  tag: 'タグ付与',
};

const STEP_TYPE_ICONS: Record<StepType, string> = {
  wait: 'bg-slate-100 text-slate-600',
  message: 'bg-green-100 text-green-700',
  condition: 'bg-orange-100 text-orange-700',
  coupon: 'bg-pink-100 text-pink-700',
  tag: 'bg-cyan-100 text-cyan-700',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-300"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Step Editor
// ---------------------------------------------------------------------------

function StepEditor({
  steps,
  onChange,
}: {
  steps: ScenarioStep[];
  onChange: (steps: ScenarioStep[]) => void;
}) {
  const addStep = () => {
    const newStep: ScenarioStep = {
      id: generateId(),
      type: 'message',
      order: steps.length + 1,
      config: {},
    };
    onChange([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    onChange(
      steps
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i + 1 })),
    );
  };

  const updateStep = (id: string, patch: Partial<ScenarioStep>) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const updateStepConfig = (id: string, key: string, value: unknown) => {
    onChange(
      steps.map((s) =>
        s.id === id ? { ...s, config: { ...s.config, [key]: value } } : s,
      ),
    );
  };

  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div
          key={step.id}
          className="border border-slate-200 rounded-lg p-4 bg-slate-50/50"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold grid place-items-center">
                {idx + 1}
              </span>
              <select
                value={step.type}
                onChange={(e) => {
                  updateStep(step.id, {
                    type: e.target.value as StepType,
                    config: {},
                  });
                }}
                className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
              >
                {(Object.keys(STEP_TYPE_LABELS) as StepType[]).map((t) => (
                  <option key={t} value={t}>
                    {STEP_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STEP_TYPE_ICONS[step.type]}`}
              >
                {STEP_TYPE_LABELS[step.type]}
              </span>
            </div>
            <button
              onClick={() => removeStep(step.id)}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step-specific config */}
          {step.type === 'wait' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={(step.config.days as number) || ''}
                onChange={(e) =>
                  updateStepConfig(step.id, 'days', parseInt(e.target.value) || 1)
                }
                placeholder="日数"
                className="w-20 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
              />
              <span className="text-sm text-slate-500">日間待機</span>
            </div>
          )}

          {step.type === 'message' && (
            <div className="space-y-2">
              <textarea
                value={(step.config.content as string) || ''}
                onChange={(e) => updateStepConfig(step.id, 'content', e.target.value)}
                placeholder="メッセージ内容を入力..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 resize-none"
              />
            </div>
          )}

          {step.type === 'condition' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={(step.config.field as string) || ''}
                onChange={(e) => updateStepConfig(step.id, 'field', e.target.value)}
                placeholder="フィールド名"
                className="w-32 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
              />
              <select
                value={(step.config.operator as string) || 'eq'}
                onChange={(e) => updateStepConfig(step.id, 'operator', e.target.value)}
                className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
              >
                <option value="eq">等しい</option>
                <option value="neq">等しくない</option>
                <option value="gt">より大きい</option>
                <option value="lt">より小さい</option>
                <option value="contains">含む</option>
              </select>
              <input
                type="text"
                value={(step.config.value as string) || ''}
                onChange={(e) => updateStepConfig(step.id, 'value', e.target.value)}
                placeholder="値"
                className="w-32 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
              />
            </div>
          )}

          {step.type === 'coupon' && (
            <div>
              <input
                type="text"
                value={(step.config.couponId as string) || ''}
                onChange={(e) => updateStepConfig(step.id, 'couponId', e.target.value)}
                placeholder="クーポンID"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
              />
            </div>
          )}

          {step.type === 'tag' && (
            <div>
              <input
                type="text"
                value={(step.config.tagName as string) || ''}
                onChange={(e) => updateStepConfig(step.id, 'tagName', e.target.value)}
                placeholder="タグ名"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
              />
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addStep}
        className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-green-400 hover:text-green-600 transition-colors"
      >
        + ステップを追加
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------

function CreateModal({
  open,
  onClose,
  onCreated,
  segments,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  segments: Segment[];
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('event');
  const [eventType, setEventType] = useState(EVENT_TYPES[0].value);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleCron, setScheduleCron] = useState('');
  const [targetSegmentId, setTargetSegmentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setTriggerType('event');
    setEventType(EVENT_TYPES[0].value);
    setScheduleTime('09:00');
    setScheduleCron('');
    setTargetSegmentId('');
    setError(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('シナリオ名は必須です');
      return;
    }
    setSaving(true);
    setError(null);

    const triggerConfig: Record<string, unknown> = {};
    if (triggerType === 'event') {
      triggerConfig.eventType = eventType;
    } else if (triggerType === 'schedule') {
      triggerConfig.time = scheduleTime;
      if (scheduleCron) triggerConfig.cron = scheduleCron;
    }

    try {
      const res = await fetch('/api/ma/scenarios', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          triggerType,
          triggerConfig,
          targetSegmentId: targetSegmentId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'シナリオの作成に失敗しました');
      }
      reset();
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">新規シナリオ作成</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              シナリオ名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 新規友だち追加ウェルカムシナリオ"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="シナリオの目的や概要..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors resize-none"
            />
          </div>

          {/* Trigger type */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">トリガータイプ</label>
            <div className="flex gap-3">
              {(['event', 'schedule', 'manual'] as TriggerType[]).map((t) => (
                <label
                  key={t}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    triggerType === t
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="triggerType"
                    value={t}
                    checked={triggerType === t}
                    onChange={() => setTriggerType(t)}
                    className="sr-only"
                  />
                  {TRIGGER_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          {/* Event trigger config */}
          {triggerType === 'event' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">イベントタイプ</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
              >
                {EVENT_TYPES.map((ev) => (
                  <option key={ev.value} value={ev.value}>
                    {ev.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Schedule trigger config */}
          {triggerType === 'schedule' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">実行時刻</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Cron式（任意）
                </label>
                <input
                  type="text"
                  value={scheduleCron}
                  onChange={(e) => setScheduleCron(e.target.value)}
                  placeholder="例: 0 9 * * *"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors font-mono"
                />
              </div>
            </div>
          )}

          {/* Target segment */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              対象セグメント（任意）
            </label>
            <select
              value={targetSegmentId}
              onChange={(e) => setTargetSegmentId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
            >
              <option value="">全ユーザー</option>
              {segments.map((seg) => (
                <option key={seg.id} value={seg.id}>
                  {seg.name}
                </option>
              ))}
            </select>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '作成中...' : 'シナリオを作成'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario Card
// ---------------------------------------------------------------------------

function ScenarioCard({
  scenario,
  onToggleActive,
  onDelete,
  onUpdate,
}: {
  scenario: Scenario;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (scenario: Scenario) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState<ScenarioStep[]>(scenario.steps || []);
  const [savingSteps, setSavingSteps] = useState(false);

  const handleSaveSteps = async () => {
    setSavingSteps(true);
    try {
      const res = await fetch(`/api/ma/scenarios/${scenario.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      const updated = await res.json();
      onUpdate(updated);
    } catch {
      // silently fail for now
    } finally {
      setSavingSteps(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className="text-sm font-bold text-slate-800 truncate cursor-pointer hover:text-green-700 transition-colors"
                onClick={() => setExpanded(!expanded)}
              >
                {scenario.name}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TRIGGER_BADGE_STYLES[scenario.triggerType]}`}
              >
                {TRIGGER_LABELS[scenario.triggerType]}
              </span>
            </div>
            {scenario.description && (
              <p className="text-xs text-slate-400 line-clamp-2">{scenario.description}</p>
            )}
          </div>

          {/* Active toggle */}
          <button
            onClick={() => onToggleActive(scenario.id, !scenario.isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
              scenario.isActive ? 'bg-green-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                scenario.isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            送信 {(scenario.stats?.sent ?? 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51" />
            </svg>
            開封 {(scenario.stats?.opened ?? 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
            </svg>
            クリック {(scenario.stats?.clicked ?? 0).toLocaleString()}
          </span>
          <span className="text-slate-300">|</span>
          <span>{scenario.steps?.length || 0}ステップ</span>
          {scenario.lastExecutedAt && (
            <>
              <span className="text-slate-300">|</span>
              <span>最終実行: {formatDate(scenario.lastExecutedAt)}</span>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            {expanded ? '閉じる' : '編集'}
          </button>
          <button
            onClick={() => {
              if (confirm('このシナリオを削除しますか？')) {
                onDelete(scenario.id);
              }
            }}
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            削除
          </button>
        </div>
      </div>

      {/* Expanded: Step Editor */}
      {expanded && (
        <div className="border-t border-slate-100 p-5 bg-slate-50/30">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-700">ステップ編集</h4>
            <button
              onClick={handleSaveSteps}
              disabled={savingSteps}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {savingSteps ? '保存中...' : 'ステップを保存'}
            </button>
          </div>
          <StepEditor steps={steps} onChange={setSteps} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MAPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch scenarios
  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ma/scenarios', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'シナリオ一覧の取得に失敗しました');
      }
      const data = await res.json().catch(() => null);
      if (data == null) {
        setScenarios([]);
      } else {
        const list = Array.isArray(data) ? data : Array.isArray(data.scenarios) ? data.scenarios : [];
        setScenarios(list);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch segments
  const fetchSegments = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/segments', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data == null) return;
      const list = Array.isArray(data) ? data : Array.isArray(data.segments) ? data.segments : [];
      setSegments(list);
    } catch {
      // Segments are optional; silently ignore errors
    }
  }, []);

  useEffect(() => {
    fetchScenarios();
    fetchSegments();
  }, [fetchScenarios, fetchSegments]);

  // Toggle active
  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/ma/scenarios/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: active }),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      setScenarios((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: active } : s)),
      );
    } catch {
      // Revert or show error silently
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/ma/scenarios/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('削除に失敗しました');
      setScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // silently fail
    }
  };

  // Update scenario in list
  const handleUpdate = (updated: Scenario) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">マーケティングオートメーション</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? '読み込み中...' : `${scenarios.length}件のシナリオ`}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新規シナリオ作成
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && scenarios.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-16 text-center text-sm text-slate-400">
          <Spinner />
          読み込み中...
        </div>
      )}

      {/* Empty */}
      {!loading && scenarios.length === 0 && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-16 text-center">
          <div className="text-slate-300 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">
            シナリオがまだ登録されていません。
          </p>
          <p className="text-sm text-slate-400 mt-1">
            「新規シナリオ作成」ボタンから作成してください。
          </p>
        </div>
      )}

      {/* Scenario Cards */}
      {scenarios.length > 0 && (
        <div className="space-y-4">
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchScenarios}
        segments={segments}
      />
    </div>
  );
}
