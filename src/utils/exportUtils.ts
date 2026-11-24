import { AppState, Category } from '../types';
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

/**
 * CSVのカテゴリ出力順（子カテゴリ名・単独カテゴリ名）。
 * ここにないカテゴリは末尾に、カテゴリ管理画面の順で並ぶ。
 */
export const CSV_CATEGORY_ORDER = [
  'ぶくとも。',
  'BOOK婚',
  'ぶくキャリ',
  'BHJ',
  'BHKK',
  'MAHT',
  'MAHB',
  'MAHNM',
  '総務',
  '採用',
  '事務',
  '本部広報・SNS周り',
  'その他',
];

const normalizeName = (name: string) => name.normalize('NFKC').trim();

/** CSV出力用に並べた入力対象カテゴリ（子・単独） */
export function getExportCategories(categories: Category[]): Category[] {
  const rank = new Map(CSV_CATEGORY_ORDER.map((n, i) => [normalizeName(n), i]));
  const rankOf = (c: Category) => rank.get(normalizeName(c.name)) ?? CSV_CATEGORY_ORDER.length;
  // sort は安定ソートなので、リスト外のカテゴリは元の順を保つ
  return [...getLeafCategories(categories)].sort((a, b) => rankOf(a) - rankOf(b));
}

/** メンバー絞り込みなし */
export const ALL_MEMBERS = '';

/** ファイル名: labor_detail_2026-11.csv / labor_summary_all_山田.csv */
export function exportFileName(
  kind: 'detail' | 'summary',
  target: string,
  memberName?: string,
): string {
  const suffix = memberName ? `_${memberName.replace(/[\\/:*?"<>|,;\s]+/g, '')}` : '';
  return `labor_${kind}_${target}${suffix}.csv`;
}

/**
 * 入力明細CSV（1行 = 週エントリ × 年月 × カテゴリ）。
 * 月またぎの週は日数比で按分し、時間・出勤日数とも按分後の値を出力する。
 */
export function buildDetailRows(
  state: AppState,
  target: string,
  memberId: string = ALL_MEMBERS,
): CsvValue[][] {
  const { members, categories, weekEntries } = state;
  const memberById = new Map(members.map((m) => [m.id, m]));
  const memberOrder = new Map(members.map((m, i) => [m.id, i]));
  const catOrder = new Map(getExportCategories(categories).map((c, i) => [c.id, i]));
  const orderOf = (id: string) => catOrder.get(id) ?? Number.MAX_SAFE_INTEGER;

  type Row = { sortKey: (string | number)[]; cells: CsvValue[] };
  const rows: Row[] = [];

  for (const entry of weekEntries) {
    if (memberId !== ALL_MEMBERS && entry.memberId !== memberId) continue;
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
export function buildSummaryRows(
  state: AppState,
  monthKeys: string[],
  memberId: string = ALL_MEMBERS,
): CsvValue[][] {
  const { categories, monthlyData } = state;
  // 稼働上限・月給合計はチーム全体で計算し、出力行だけ絞り込む（チェック画面の値と一致させる）
  const members = state.members;
  const targetMembers =
    memberId === ALL_MEMBERS ? members : members.filter((m) => m.id === memberId);
  const leaves = getExportCategories(categories);
  const rows: CsvValue[][] = [SUMMARY_HEADER];

  for (const monthKey of monthKeys) {
    const { year, month } = parseMonthKey(monthKey);
    const ctx = getMonthContext(year, month, members);
    // メンバーごとにまとめて出力する
    const byMember = new Map<string, CsvValue[][]>(targetMembers.map((m) => [m.id, []]));
    for (const cat of leaves) {
      const { parentName, childName } = getCategoryPath(categories, cat.id);
      for (const b of calcMemberBreakdown(monthKey, cat.id, targetMembers, monthlyData, ctx)) {
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
