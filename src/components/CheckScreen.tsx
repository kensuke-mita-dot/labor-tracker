import { useState, useMemo } from 'react';
import { AppState } from '../types';
import {
  toMonthKey,
  parseMonthKey,
  formatMonthLabel,
} from '../utils/dateUtils';
import {
  calcMonthlySummary,
  formatHours,
  formatCurrency,
  formatPercent,
} from '../utils/calcUtils';

interface Props {
  appState: AppState;
}

function getAvailableMonths(monthlyData: Record<string, unknown>): string[] {
  const keys = Object.keys(monthlyData);
  if (keys.length === 0) {
    // デフォルト: 今月
    const now = new Date();
    return [toMonthKey(now.getFullYear(), now.getMonth() + 1)];
  }
  return [...keys].sort();
}

export default function CheckScreen({ appState }: Props) {
  const { members, categories, monthlyData } = appState;

  const availableMonths = useMemo(
    () => getAvailableMonths(monthlyData),
    [monthlyData],
  );

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const cur = toMonthKey(now.getFullYear(), now.getMonth() + 1);
    return availableMonths.includes(cur) ? cur : availableMonths[availableMonths.length - 1];
  });

  const summary = useMemo(() => {
    const { year, month } = parseMonthKey(selectedMonth);
    return calcMonthlySummary(selectedMonth, year, month, members, categories, monthlyData);
  }, [selectedMonth, members, categories, monthlyData]);

  const { year, month } = parseMonthKey(selectedMonth);

  return (
    <div className="space-y-4">
      {/* 月選択 */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 shrink-0">対象月</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {availableMonths.map((mk) => {
            const { year: y, month: m } = parseMonthKey(mk);
            return (
              <option key={mk} value={mk}>
                {formatMonthLabel(y, m)}
              </option>
            );
          })}
        </select>
      </div>

      {/* 概要カード */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">チーム総稼働時間（上限）</p>
          <p className="text-xl font-bold text-gray-800">{formatHours(summary.monthlyTotalHours)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {members.length}名 × {formatMonthLabel(year, month)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">入力済み合計時間</p>
          <p className="text-xl font-bold text-gray-800">{formatHours(summary.totalInputHours)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {summary.monthlyTotalHours > 0
              ? formatPercent((summary.totalInputHours / summary.monthlyTotalHours) * 100) + ' 入力済'
              : '—'}
          </p>
        </div>
      </div>

      {/* カテゴリ別サマリー */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">カテゴリ別サマリー</h2>
        </div>

        {categories.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">
            カテゴリが登録されていません。
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {/* ヘッダー */}
            <div className="grid grid-cols-4 px-4 py-2 text-xs text-gray-400 font-medium">
              <span>カテゴリ</span>
              <span className="text-right">合計時間</span>
              <span className="text-right">稼働シェア</span>
              <span className="text-right">人件費</span>
            </div>

            {summary.categories.map((cat) => (
              <div
                key={cat.categoryId}
                className="grid grid-cols-4 px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-800 truncate pr-2">{cat.categoryName}</span>
                <span className="text-right text-gray-600">{formatHours(cat.totalHours)}</span>
                <span className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      cat.workShare >= 50
                        ? 'bg-blue-100 text-blue-700'
                        : cat.workShare >= 20
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {formatPercent(cat.workShare)}
                  </span>
                </span>
                <span className="text-right text-gray-800 font-medium">
                  {formatCurrency(cat.laborCost)}
                </span>
              </div>
            ))}

            {/* 合計行 */}
            <div className="grid grid-cols-4 px-4 py-3 bg-gray-50 text-sm font-semibold">
              <span className="text-gray-700">合計</span>
              <span className="text-right text-gray-700">{formatHours(summary.totalInputHours)}</span>
              <span className="text-right text-gray-700">
                {formatPercent(
                  summary.monthlyTotalHours > 0
                    ? (summary.totalInputHours / summary.monthlyTotalHours) * 100
                    : 0,
                )}
              </span>
              <span className="text-right text-gray-800">{formatCurrency(summary.totalLaborCost)}</span>
            </div>
          </div>
        )}
      </div>

      {/* メンバー別内訳 */}
      {members.length > 0 && categories.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">メンバー別内訳</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {members.map((member) => {
              const memberData = monthlyData[selectedMonth]?.[member.id] ?? {};
              const totalH = Object.values(memberData).reduce((s, v) => s + v, 0);
              return (
                <div key={member.id} className="px-4 py-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-800">{member.name}</span>
                    <span className="text-sm text-gray-600">{formatHours(totalH)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const h = memberData[cat.id] ?? 0;
                      if (h === 0) return null;
                      return (
                        <span
                          key={cat.id}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                        >
                          {cat.name}: {formatHours(h)}
                        </span>
                      );
                    })}
                    {totalH === 0 && (
                      <span className="text-xs text-gray-400">未入力</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
