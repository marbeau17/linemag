'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

// ---------- types ----------

interface ServiceType {
  id: string;
  name: string;
  duration: number;
  description: string;
  icon: string;
}

interface SlotSummary {
  date: string;          // YYYY-MM-DD
  availableCount: number;
}

interface TimeSlot {
  id: string;
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  consultantName: string;
}

interface ReservationResult {
  id: string;
  meetUrl: string;
}

// ---------- constants ----------

const HARDCODED_CUSTOMER_ID = 'cust_placeholder_001';

const SERVICE_TYPES: ServiceType[] = [
  {
    id: 'general',
    name: '一般相談',
    duration: 30,
    description: '日常的なご質問やお悩みについてお気軽にご相談いただけます。',
    icon: '💬',
  },
  {
    id: 'technical',
    name: '技術相談',
    duration: 60,
    description: '技術的な課題や実装方針について専門スタッフがサポートします。',
    icon: '🛠',
  },
  {
    id: 'career',
    name: 'キャリア相談',
    duration: 60,
    description: 'キャリアプランや転職・スキルアップのご相談を承ります。',
    icon: '🎯',
  },
];

const STEPS = ['相談種別選択', '日付選択', '時間選択', '確認・予約'] as const;

// Japanese holidays for the next 30‑day window (static list — extend as needed)
const HOLIDAYS = new Set([
  '2026-03-21', // 春分の日 (振替)
  '2026-04-29', // 昭和の日
  '2026-05-03', // 憲法記念日
  '2026-05-04', // みどりの日
  '2026-05-05', // こどもの日
  '2026-05-06', // 振替休日
]);

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// ---------- helpers ----------

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function displayDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY_LABELS[d.getDay()]})`;
}

// ---------- component ----------

export default function BookingPage() {
  const [step, setStep] = useState(1);

  // Step 1
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);

  // Step 2
  const [slotSummaries, setSlotSummaries] = useState<SlotSummary[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Step 3
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Step 4
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReservationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- date range for calendar ----
  const { startDate, endDate, days } = useMemo(() => {
    const today = new Date();
    const start = formatDate(today);
    const end = new Date(today);
    end.setDate(end.getDate() + 29);
    const endStr = formatDate(end);

    const dayList: Date[] = [];
    const cur = new Date(today);
    for (let i = 0; i < 30; i++) {
      dayList.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return { startDate: start, endDate: endStr, days: dayList };
  }, []);

  // ---- fetch slot summaries when entering step 2 ----
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 2 || !selectedService) return;
    setLoadingSlots(true);
    setSlotSummaries([]);
    setSlotsError(null);
    fetch(
      `/api/booking/slots?startDate=${startDate}&endDate=${endDate}&durationMinutes=${selectedService.duration}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error('空き状況の取得に失敗しました');
        return r.json();
      })
      .then((data: SlotSummary[]) => setSlotSummaries(Array.isArray(data) ? data : []))
      .catch((e) => {
        setSlotSummaries([]);
        setSlotsError(e instanceof Error ? e.message : '空き状況の取得に失敗しました');
      })
      .finally(() => setLoadingSlots(false));
  }, [step, selectedService, startDate, endDate]);

  // ---- fetch time slots when entering step 3 ----
  const [timesError, setTimesError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 3 || !selectedDate || !selectedService) return;
    setLoadingTimes(true);
    setTimeSlots([]);
    setTimesError(null);
    fetch(
      `/api/booking/slots/${selectedDate}?durationMinutes=${selectedService.duration}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error('時間帯の取得に失敗しました');
        return r.json();
      })
      .then((data: TimeSlot[]) => setTimeSlots(Array.isArray(data) ? data : []))
      .catch((e) => {
        setTimeSlots([]);
        setTimesError(e instanceof Error ? e.message : '時間帯の取得に失敗しました');
      })
      .finally(() => setLoadingTimes(false));
  }, [step, selectedDate, selectedService]);

  // ---- availability lookup ----
  const availabilityMap = useMemo(() => {
    const m = new Map<string, number>();
    slotSummaries.forEach((s) => m.set(s.date, s.availableCount));
    return m;
  }, [slotSummaries]);

  // ---- submit reservation ----
  const handleSubmit = useCallback(async () => {
    if (!selectedService || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/booking/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: HARDCODED_CUSTOMER_ID,
          serviceType: selectedService.id,
          date: selectedDate,
          slotId: selectedSlot.id,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '予約に失敗しました');
      setResult(data as ReservationResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '予約に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }, [selectedService, selectedDate, selectedSlot, notes]);

  // ---- navigation ----
  const goBack = () => {
    setError(null);
    if (step === 2) { setSelectedDate(null); }
    if (step === 3) { setSelectedSlot(null); }
    setStep((s) => Math.max(1, s - 1));
  };

  const selectService = (s: ServiceType) => {
    setSelectedService(s);
    setSelectedDate(null);
    setSelectedSlot(null);
    setResult(null);
    setNotes('');
    setStep(2);
  };

  const selectDate = (iso: string) => {
    setSelectedDate(iso);
    setSelectedSlot(null);
    setStep(3);
  };

  const selectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep(4);
  };

  // ================================================================
  // RENDER
  // ================================================================

  // ---- success screen ----
  if (result) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#06C755] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">予約が確定しました</h2>
          <p className="text-sm text-slate-500 mb-6">以下のリンクから当日ご参加ください。</p>

          <div className="w-full bg-white rounded-xl border border-slate-200 p-5 text-left space-y-3 mb-6">
            <Row label="相談種別" value={selectedService?.name ?? '-'} />
            <Row label="日時" value={selectedDate && selectedSlot ? `${displayDate(selectedDate)} ${selectedSlot.startTime} - ${selectedSlot.endTime}` : '-'} />
            <Row label="担当" value={selectedSlot?.consultantName ?? '-'} />
          </div>

          {result.meetUrl && (
            <a
              href={result.meetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block text-center bg-[#06C755] text-white font-bold text-base py-3 rounded-xl active:opacity-80 transition"
            >
              Google Meet を開く
            </a>
          )}

          <button
            onClick={() => { setResult(null); setStep(1); }}
            className="mt-4 text-sm text-slate-500 underline"
          >
            トップに戻る
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Step indicator */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <div className="flex items-center px-4 py-3">
          {step > 1 && (
            <button
              onClick={goBack}
              className="mr-2 w-10 h-10 flex items-center justify-center rounded-full active:bg-slate-100 transition"
              aria-label="戻る"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1">
            <p className="text-xs text-slate-400 font-medium">ステップ {step}/4</p>
            <p className="text-sm font-bold text-slate-800">{STEPS[step - 1]}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-1 bg-[#06C755] transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="px-4 py-5">
        {step === 1 && <Step1 onSelect={selectService} />}
        {step === 2 && (
          <Step2
            days={days}
            availabilityMap={availabilityMap}
            loading={loadingSlots}
            error={slotsError}
            onSelect={selectDate}
          />
        )}
        {step === 3 && (
          <Step3
            slots={timeSlots}
            loading={loadingTimes}
            error={timesError}
            selectedSlot={selectedSlot}
            onSelect={selectSlot}
          />
        )}
        {step === 4 && selectedService && selectedDate && selectedSlot && (
          <Step4
            service={selectedService}
            date={selectedDate}
            slot={selectedSlot}
            notes={notes}
            onNotesChange={setNotes}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Shell>
  );
}

// ================================================================
// Sub-components
// ================================================================

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto">
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

// ---- Step 1: Service type selection ----

function Step1({ onSelect }: { onSelect: (s: ServiceType) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 mb-2">ご希望の相談種別を選択してください。</p>
      {SERVICE_TYPES.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 active:border-[#06C755] active:ring-2 active:ring-[#06C755]/20 transition"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{s.name}</span>
                <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                  {s.duration}分
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.description}</p>
            </div>
            <svg className="w-5 h-5 text-slate-300 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---- Step 2: Date selection ----

function Step2({
  days,
  availabilityMap,
  loading,
  error,
  onSelect,
}: {
  days: Date[];
  availabilityMap: Map<string, number>;
  loading: boolean;
  error: string | null;
  onSelect: (iso: string) => void;
}) {
  // Group days by month for display
  const months = useMemo(() => {
    const map = new Map<string, Date[]>();
    days.forEach((d) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return Array.from(map.entries());
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
        <span className="ml-2 text-sm text-slate-400">空き状況を取得中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200 mb-4">
          {error}
        </div>
        <p className="text-xs text-slate-400">時間を置いて再度お試しください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">ご希望の日付を選択してください。</p>

      {months.map(([monthKey, monthDays]) => {
        const sample = monthDays[0];
        const year = sample.getFullYear();
        const month = sample.getMonth();

        // Build a full calendar grid for this month view
        const firstOfMonth = new Date(year, month, 1);
        const startDow = firstOfMonth.getDay(); // 0=Sun

        // We only show the dates that are in our 30-day range
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const validDates = new Set(monthDays.map((d) => d.getDate()));

        const cells: (number | null)[] = [];
        for (let i = 0; i < startDow; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        return (
          <div key={monthKey}>
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              {year}年{month + 1}月
            </h3>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center mb-1">
              {WEEKDAY_LABELS.map((w, i) => (
                <span
                  key={w}
                  className={`text-xs font-medium py-1 ${
                    i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'
                  }`}
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((dayNum, idx) => {
                if (dayNum === null) return <div key={`empty-${idx}`} />;

                const iso = formatDate(new Date(year, month, dayNum));
                const inRange = validDates.has(dayNum);
                const isHoliday = HOLIDAYS.has(iso);
                const available = availabilityMap.get(iso) ?? 0;
                const dow = (startDow + dayNum - 1) % 7;
                const isSelectable = inRange && available > 0;

                return (
                  <button
                    key={iso}
                    disabled={!isSelectable}
                    onClick={() => isSelectable && onSelect(iso)}
                    className={`
                      relative flex flex-col items-center justify-center rounded-lg py-2 min-h-[48px] transition
                      ${isSelectable
                        ? 'bg-white border border-slate-200 active:border-[#06C755] active:bg-green-50'
                        : 'opacity-40 cursor-default'
                      }
                    `}
                  >
                    <span
                      className={`text-sm font-medium ${
                        !inRange
                          ? 'text-slate-300'
                          : isHoliday || dow === 0
                          ? 'text-red-500'
                          : dow === 6
                          ? 'text-blue-500'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {isHoliday && inRange && (
                      <span className="text-[9px] text-red-400 leading-none">祝</span>
                    )}
                    {isSelectable && (
                      <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#06C755]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-4 text-xs text-slate-400 pt-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#06C755] inline-block" /> 空きあり
        </span>
        <span className="flex items-center gap-1">
          <span className="text-red-400">祝</span> 祝日
        </span>
      </div>
    </div>
  );
}

// ---- Step 3: Time slot selection ----

function Step3({
  slots,
  loading,
  error,
  selectedSlot,
  onSelect,
}: {
  slots: TimeSlot[];
  loading: boolean;
  error: string | null;
  selectedSlot: TimeSlot | null;
  onSelect: (slot: TimeSlot) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
        <span className="ml-2 text-sm text-slate-400">時間帯を取得中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200 mb-4">
          {error}
        </div>
        <p className="text-xs text-slate-400">時間を置いて再度お試しください。</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-sm">この日に空いている時間帯はありません。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 mb-2">ご希望の時間帯を選択してください。</p>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          return (
            <button
              key={slot.id}
              onClick={() => onSelect(slot)}
              className={`
                text-left rounded-xl border p-3 min-h-[48px] transition
                ${isSelected
                  ? 'border-[#06C755] bg-green-50 ring-2 ring-[#06C755]/20'
                  : 'border-slate-200 bg-white active:border-[#06C755]'
                }
              `}
            >
              <p className={`text-sm font-bold ${isSelected ? 'text-[#06C755]' : 'text-slate-800'}`}>
                {slot.startTime} - {slot.endTime}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{slot.consultantName}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Step 4: Confirmation ----

function Step4({
  service,
  date,
  slot,
  notes,
  onNotesChange,
  submitting,
  error,
  onSubmit,
}: {
  service: ServiceType;
  date: string;
  slot: TimeSlot;
  notes: string;
  onNotesChange: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">以下の内容でご予約を確定します。</p>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <Row label="相談種別" value={`${service.name}(${service.duration}分)`} />
        <Row label="日付" value={displayDate(date)} />
        <Row label="時間" value={`${slot.startTime} - ${slot.endTime}`} />
        <Row label="担当" value={slot.consultantName} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          備考 <span className="text-slate-400 font-normal">(任意)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="事前に伝えておきたいことがあればご記入ください"
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20 transition resize-none"
        />
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-[#06C755] text-white font-bold text-base py-4 rounded-xl active:opacity-80 disabled:opacity-50 transition"
      >
        {submitting ? (
          <>
            <Spinner white /> 送信中…
          </>
        ) : (
          '予約を確定する'
        )}
      </button>
    </div>
  );
}

// ---- Spinner ----

function Spinner({ white }: { white?: boolean }) {
  return (
    <svg
      className={`animate-spin h-5 w-5 ${white ? 'text-white' : 'text-[#06C755]'}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
