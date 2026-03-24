export interface Consultant {
  id: string;
  name: string;
  email: string;
  meetUrl: string;
  specialties: string[];
  isActive: boolean;
  maxDailySlots: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  id: string;
  consultantId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isAvailable: boolean;
  createdAt: string;
  consultantName?: string;
}

export interface Reservation {
  id: string;
  customerId: string;
  timeSlotId: string;
  consultantId: string;
  status: 'pending' | 'confirmed' | 'reminded' | 'completed' | 'cancelled' | 'no_show';
  serviceType: string;
  notes: string | null;
  meetUrl: string | null;
  reminderSentAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  consultantName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface BookingSettings {
  id: string;
  businessHours: Record<string, { start: string; end: string }>;
  slotDurations: number[];
  bufferMinutes: number;
  maxAdvanceDays: number;
  holidays: string[];
}

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending: '仮予約',
  confirmed: '確定',
  reminded: 'リマインド済',
  completed: '完了',
  cancelled: 'キャンセル',
  no_show: 'ノーショー',
};

export const RESERVATION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  reminded: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-red-100 text-red-700',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  general: '一般相談',
  technical: '技術相談',
  career: 'キャリア相談',
};
