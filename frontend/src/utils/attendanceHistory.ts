import type { OfflineAttendanceItem } from './offlineQueue';

export interface HistoryItem {
  id: number | string;
  date: string;
  type: string;
  time: string;
  status: string;
  is_overnight?: boolean;
  actual_date?: string;
  occurred_at?: string;
  is_offline?: boolean;
}

export function attendanceTimestamp(item: HistoryItem): number {
  const value = (item.occurred_at || `${item.actual_date ?? item.date} ${item.time}`).replace(' ', 'T');
  const timestamp = Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}+07:00`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergeAttendanceHistory(server: HistoryItem[], queue: OfflineAttendanceItem[]): HistoryItem[] {
  const pending = queue.filter(item => item.status !== 'failed').map(item => ({
    id: item.id,
    date: item.waktu_offline.split(' ')[0],
    actual_date: item.waktu_offline.split(' ')[0],
    occurred_at: item.waktu_offline,
    type: item.tipe,
    time: (item.waktu_offline.split(' ')[1] || '').slice(0, 5),
    status: 'Menunggu Sinkronisasi',
    is_offline: true,
  }));
  return [...server.filter(item => !item.is_offline), ...pending]
    .sort((a, b) => attendanceTimestamp(b) - attendanceTimestamp(a));
}

const overtimeType = (type: string) => type.toLowerCase().replace(/_/g, ' ').trim();
const isStart = (type: string) => ['mulai lembur', 'lembur masuk', 'lembur'].includes(overtimeType(type));
const isEnd = (type: string) => ['selesai lembur', 'lembur pulang', 'lembur keluar'].includes(overtimeType(type));

export function getOvertimeSession(history: HistoryItem[], now: number) {
  const latest = history.filter(item => isStart(item.type) || isEnd(item.type))
    .sort((a, b) => attendanceTimestamp(b) - attendanceTimestamp(a))[0];
  const age = latest ? now - attendanceTimestamp(latest) : Infinity;
  return {
    start: latest && isStart(latest.type) && age >= 0 && age <= 24 * 60 * 60 * 1000 ? latest : undefined,
    end: latest && isEnd(latest.type) ? latest : undefined,
  };
}
