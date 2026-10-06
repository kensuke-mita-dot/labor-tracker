import { Member, Category, MonthlyData } from '../types';
import { getMonthlyTotalHours } from './dateUtils';
import { buildCategoryGroups } from './categoryUtils';

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  totalHours: number;
  workShare: number;  // %
  laborCost: number;  // 円
}

export interface CategoryGroupSummary extends CategorySummary {
  children: CategorySummary[]; // 子カテゴリ内訳（単独カテゴリは空）
}

export interface MonthlySummary {
  monthKey: string;
  year: number;
  month: number;
  monthlyTotalHours: number; // チーム総稼働時間上限
  totalInputHours: number;   // 入力された合計時間
  categories: CategorySummary[];    // 入力対象カテゴリ（子・単独）
  groups: CategoryGroupSummary[];   // 親カテゴリ単位の集計
  totalLaborCost: number;
}

/**
 * 月次サマリーを計算する。
 * チーム総稼働時間上限 = メンバー数 × 8 × (月の日数 - 9)
 * 稼働シェア = カテゴリ合計時間 / チーム総稼働時間上限 × 100
 * 人件費 = 稼働シェア/100 × 全メンバー月給合計
 */
export function calcMonthlySummary(
  monthKey: string,
  year: number,
  month: number,
  members: Member[],
  categories: Category[],
  monthlyData: MonthlyData,
): MonthlySummary {
  const totalSalary = members.reduce((sum, m) => sum + m.monthlySalary, 0);
  const perPersonHours = getMonthlyTotalHours(year, month);
  const teamTotalHours = perPersonHours * (members.length || 1);

  const dataForMonth = monthlyData[monthKey] ?? {};

  const summarize = (cat: Category): CategorySummary => {
    let totalHours = 0;
    for (const memberHours of Object.values(dataForMonth)) {
      totalHours += memberHours[cat.id] ?? 0;
    }
    const workShare = teamTotalHours > 0 ? (totalHours / teamTotalHours) * 100 : 0;
    const laborCost = (workShare / 100) * totalSalary;
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      totalHours,
      workShare,
      laborCost,
    };
  };

  // 親カテゴリの値は子カテゴリの合計から算出する
  const groups: CategoryGroupSummary[] = buildCategoryGroups(categories).map((g) => {
    if (g.children.length === 0) return { ...summarize(g.category), children: [] };
    const children = g.children.map(summarize);
    return {
      categoryId: g.category.id,
      categoryName: g.category.name,
      totalHours: children.reduce((s, c) => s + c.totalHours, 0),
      workShare: children.reduce((s, c) => s + c.workShare, 0),
      laborCost: children.reduce((s, c) => s + c.laborCost, 0),
      children,
    };
  });

  const categorySummaries: CategorySummary[] = groups.flatMap((g) =>
    g.children.length > 0 ? g.children : [g],
  );

  const totalInputHours = categorySummaries.reduce((s, c) => s + c.totalHours, 0);
  const totalLaborCost = categorySummaries.reduce((s, c) => s + c.laborCost, 0);

  return {
    monthKey,
    year,
    month,
    monthlyTotalHours: teamTotalHours,
    totalInputHours,
    categories: categorySummaries,
    groups,
    totalLaborCost,
  };
}

/** メンバー別・月別の合計時間 */
export function getMemberMonthlyHours(
  memberId: string,
  monthKey: string,
  categoryIds: string[],
  monthlyData: MonthlyData,
): Record<string, number> {
  const data = monthlyData[monthKey]?.[memberId] ?? {};
  const result: Record<string, number> = {};
  for (const catId of categoryIds) {
    result[catId] = data[catId] ?? 0;
  }
  return result;
}

export function formatHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

export function formatCurrency(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}
