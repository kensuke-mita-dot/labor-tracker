import { AppState } from '../types';
import { CsvValue, roundTo } from './csvUtils';
import { getCategoryPath, getLeafCategories } from './categoryUtils';
import { parseDate, parseMonthKey, splitWeekByMonth } from './dateUtils';
import { calcMemberBreakdown, getMonthContext } from './calcUtils';

/** 対象月セレクターの「全期間」 */
export const ALL_PERIOD = 'all';

export const DETAIL_HEADER = [
  '年月', '週開始日(月曜)', '週終了日(日曜)', 'メンバー名', '出勤日数',
  '親カテゴリ', '子カテゴリ', '時間(h)', '月給',
];

export const SUMMARY_HEADER = [
  '年月', 'メンバー名', '親カテゴリ', '子カテゴリ', '合計時間(h)',
  '月の総稼働時間(h)', '稼働シェア(%)', '月給', '人件費(円)',
];

const DELETED_MEMBER = '(削除済みメンバー)';

/** ファイル名用の期間ラベル: "2026-11" / "all" */
export function exportFileName(kind: 'detail' | 'summary', target: string): string {
  return `labor_${kind}_${target}.csv`;
}

/**
 * 入力明細CSV（1行 = 週エントリ × 年月 × カテゴリ）。
 * 月またぎの週は日数比で按分し、時間・出勤日数とも按分後の値を出力する。
 */
export function buildDetailRows(state: AppState, target: string): CsvValue[][] {
  const { members, categories, weekEntries } = state;
  const memberById = new Map(members.map((m) => [m.id, m]));
  const memberOrder = new Map(members.map((m, i) => [m.id, i]));
  const catOrder = new Map(getLeafCategories(categories).map((c, i) => [c.id, i]));
  const orderOf = (id: string) => catOrder.get(id) ?? Number.MAX_SAFE_INTEGER;

  type Row = { sortKey: (string | number)[]; cells: CsvValue[] };
  const rows: Row[] = [];

  for (const entry of weekEntries) {
    const member = memberById.get(entry.memberId);
    const splits = splitWeekByMonth(parseDate(entry.weekStart), parseDate(entry.weekEnd));
    const catIds = Object.keys(entry.hours)
      .filter((id) => (entry.hours[id] ?? 0) > 0)
      .sort((a, b) => orderOf(a) - orderOf(b));

    for (const { monthKey, ratio } of splits) {
      if (target !== ALL_PERIOD && monthKey !== target) continue;
      const base: CsvValue[] = [
        monthKey,
        entry.weekStart,
        entry.weekEnd,
        member?.name ?? DELETED_MEMBER,
        entry.workDays === undefined ? '' : roundTo(entry.workDays * ratio, 2),
      ];
      const salary = member?.monthlySalary ?? '';
      const sortBase = [monthKey, entry.weekStart, memberOrder.get(entry.memberId) ?? Number.MAX_SAFE_INTEGER];

      if (catIds.length === 0) {
        // 時間入力がない週も出勤日数を残すため1行出力する
        rows.push({ sortKey: [...sortBase, -1], cells: [...base, '', '', 0, salary] });
        continue;
      }
      for (const catId of catIds) {
        const { parentName, childName } = getCategoryPath(categories, catId);
        rows.push({
          sortKey: [...sortBase, orderOf(catId)],
          cells: [...base, parentName, childName, roundTo(entry.hours[catId] * ratio, 2), salary],
        });
      }
    }
  }

  rows.sort((a, b) => {
    for (let i = 0; i < a.sortKey.length; i++) {
      if (a.sortKey[i] < b.sortKey[i]) return -1;
      if (a.sortKey[i] > b.sortKey[i]) return 1;
    }
    return 0;
  });
  return [DETAIL_HEADER, ...rows.map((r) => r.cells)];
}

/**
 * 月次集計CSV（1行 = 年月 × メンバー × 子カテゴリ）。
 * 稼働シェア・人件費はチェック画面と同じ calcMemberBreakdown で算出する。
 */
export function buildSummaryRows(state: AppState, monthKeys: string[]): CsvValue[][] {
  const { members, categories, monthlyData } = state;
  const leaves = getLeafCategories(categories);
  const rows: CsvValue[][] = [SUMMARY_HEADER];

  for (const monthKey of monthKeys) {
    const { year, month } = parseMonthKey(monthKey);
    const ctx = getMonthContext(year, month, members);
    // メンバーごとにまとめて出力する
    const byMember = new Map<string, CsvValue[][]>(members.map((m) => [m.id, []]));
    for (const cat of leaves) {
      const { parentName, childName } = getCategoryPath(categories, cat.id);
      for (const b of calcMemberBreakdown(monthKey, cat.id, members, monthlyData, ctx)) {
        byMember.get(b.memberId)!.push([
          monthKey,
          b.memberName,
          parentName,
          childName,
          roundTo(b.hours, 2),
          ctx.teamTotalHours,
          roundTo(b.workShare, 2),
          b.monthlySalary,
          Math.round(b.laborCost),
        ]);
      }
    }
    for (const memberRows of byMember.values()) rows.push(...memberRows);
  }
  return rows;
}
