import type { LinearWorklog } from '../types/worklog';

export function overtimeStats(items: LinearWorklog[]): { totalOvertimeHours: number; daysWithOvertime: number } {
  const overtimeByDate: Record<string, number> = {};
  for (const item of items) {
    if (item.isPause) continue;
    if (item.isOvertime) {
      overtimeByDate[item.date] = (overtimeByDate[item.date] ?? 0) + item.hours;
    }
  }
  return {
    totalOvertimeHours: Object.values(overtimeByDate).reduce((s, n) => s + n, 0),
    daysWithOvertime: Object.keys(overtimeByDate).length,
  };
}

export function totalWorkedHours(items: LinearWorklog[]): number {
  return items.filter(i => !i.isPause).reduce((s, i) => s + i.hours, 0);
}
