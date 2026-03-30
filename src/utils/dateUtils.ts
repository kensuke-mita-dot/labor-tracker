// サービス開始日: 2026/4/6（月）
export const SERVICE_START_STR = '2026-04-06';

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

/** date を含む週の月曜日を返す */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=日, 1=月, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * 送信日基準で「先週（月〜日）」を返す。
 * 送信日がサービス開始日より前の場合はサービス開始日を基準に使う。
 */
export function getLastWeekPeriod(today: Date = new Date()): { start: Date; end: Date } {
  const serviceStart = parseDate(SERVICE_START_STR);
  const effective = today < serviceStart ? serviceStart : today;
  const currentMonday = getMondayOfWeek(effective);

  const lastMonday = new Date(currentMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);

  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastSunday.getDate() + 6);

  return { start: lastMonday, end: lastSunday };
}

/**
 * 週（月〜日）が複数月にまたがる場合、月ごとに日数按分して分割する。
 * 返り値: [{ monthKey: "YYYY-MM", ratio: number, days: number }, ...]
 */
export function splitWeekByMonth(
  weekStart: Date,
  weekEnd: Date,
): Array<{ monthKey: string; days: number; ratio: number }> {
  const monthMap: Record<string, number> = {};

  const cur = new Date(weekStart);
  while (cur <= weekEnd) {
    const key = toMonthKey(cur.getFullYear(), cur.getMonth() + 1);
    monthMap[key] = (monthMap[key] ?? 0) + 1;
    cur.setDate(cur.getDate() + 1);
  }

  const totalDays = 7;
  return Object.entries(monthMap).map(([monthKey, days]) => ({
    monthKey,
    days,
    ratio: days / totalDays,
  }));
}

/** 月の日数 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 月の総稼働時間 = 8 × (月の日数 - 9) */
export function getMonthlyTotalHours(year: number, month: number): number {
  return 8 * (getDaysInMonth(year, month) - 9);
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];

export function formatDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${DOW_JA[d.getDay()]}）`;
}

export function formatWeekRange(start: Date, end: Date): string {
  return `${formatDate(start)} 〜 ${formatDate(end)}`;
}

export function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}
