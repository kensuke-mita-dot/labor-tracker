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

const ADMIN_PASSWORD = 'admin.dot';

interface Props {
  appState: AppState;
}

function getAvailableMonths(monthlyData: Record<string, unknown>): string[] {
  const keys = Object.keys(monthlyData);
  if (keys.length === 0) {
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

  // 管理者認証
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const summary = useMemo(() => {
    const { year, month } = parseMonthKey(selectedMonth);
    return calcMonthlySummary(selectedMonth, year, month, members, categories, monthlyData);
  }, [selectedMonth, members, categories, monthlyData]);

  const { year, month } = parseMonthKey(selectedMonth);

  function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowPasswordInput(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('パスワードが違います。');
    }
  }

  // カテゴリ×メンバー別の人件費を計算
  const totalSalary = members.reduce((s, m) => s + m.monthlySalary, 0);

  function renderShareBadge(share: number, bold: boolean) {
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-xs ${bold ? 'font-bold' : 'font-medium'} ${
          share >= 50
            ? 'bg-blue-100 text-blue-700'
            : share >= 20
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        {formatPercent(share)}
      </span>
    );
  }

  /** 管理者のみ: メンバー別人件費内訳 */
  function renderMemberBreakdown(categoryId: string) {
    if (!isAdmin || members.length === 0) return null;
    return (
      <div className="bg-gray-50 px-6 pb-2 space-y-1">
        {members.map((member) => {
          const memberHours = monthlyData[selectedMonth]?.[member.id]?.[categoryId] ?? 0;
          if (memberHours === 0) return null;
          const memberShare = summary.monthlyTotalHours > 0
            ? memberHours / summary.monthlyTotalHours
            : 0;
          const memberCost = memberShare * totalSalary;
          return (
            <div key={member.id} className="flex items-center justify-between text-xs text-gray-500 py-0.5">
              <span className="pl-2 border-l-2 border-gray-300">{member.name}</span>
              <div className="flex gap-4">
                <span>{formatHours(memberHours)}</span>
                <span className="text-gray-700 font-medium w-20 text-right">
                  {formatCurrency(memberCost)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

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
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] px-4 py-2 text-xs text-gray-400 font-medium">
              <span>カテゴリ</span>
              <span className="text-right">合計時間</span>
              <span className="text-right">稼働シェア</span>
              <span className="text-right">人件費</span>
            </div>

            {summary.groups.map((group) => {
              const isParent = group.children.length > 0;
              return (
                <div key={group.categoryId}>
                  {/* 親カテゴリ・単独カテゴリ行 */}
                  <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] px-4 py-3 text-sm bg-blue-50">
                    <span className="font-bold text-blue-900 truncate pr-2">{group.categoryName}</span>
                    <span className="text-right font-bold text-blue-900">{formatHours(group.totalHours)}</span>
                    <span className="text-right">{renderShareBadge(group.workShare, true)}</span>
                    <span className="text-right font-bold text-blue-900">
                      {formatCurrency(group.laborCost)}
                    </span>
                  </div>
                  {!isParent && renderMemberBreakdown(group.categoryId)}

                  {/* 子カテゴリ内訳 */}
                  {group.children.map((cat) => (
                    <div key={cat.categoryId}>
                      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors">
                        <span className="text-gray-700 truncate pl-3 pr-2">
                          <span className="text-gray-300 mr-1">└</span>
                          {cat.categoryName}
                        </span>
                        <span className="text-right text-gray-600">{formatHours(cat.totalHours)}</span>
                        <span className="text-right">{renderShareBadge(cat.workShare, false)}</span>
                        <span className="text-right text-gray-700">{formatCurrency(cat.laborCost)}</span>
                      </div>
                      {renderMemberBreakdown(cat.categoryId)}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* 合計行 */}
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] px-4 py-3 bg-gray-50 text-sm font-semibold">
              <span className="text-gray-700">総合計</span>
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

      {/* 管理者ログイン／ログアウト */}
      <div className="flex justify-end">
        {isAdmin ? (
          <button
            onClick={() => setIsAdmin(false)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            🔓 管理者モード終了
          </button>
        ) : showPasswordInput ? (
          <form onSubmit={handleAdminLogin} className="flex items-center gap-2">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
              placeholder="管理者パスワード"
              autoFocus
              className="border border-gray-300 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg">
              確認
            </button>
            <button
              type="button"
              onClick={() => { setShowPasswordInput(false); setPasswordError(''); setPasswordInput(''); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              キャンセル
            </button>
            {passwordError && <span className="text-xs text-red-500">{passwordError}</span>}
          </form>
        ) : (
          <button
            onClick={() => setShowPasswordInput(true)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            🔒 管理者として表示
          </button>
        )}
      </div>
    </div>
  );
}
