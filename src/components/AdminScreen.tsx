import { useState, useMemo } from 'react';
import { AppState, Member, Category, MonthlyData } from '../types';
import {
  toMonthKey,
  parseMonthKey,
  formatMonthLabel,
  splitWeekByMonth,
  parseDate,
} from '../utils/dateUtils';

const ADMIN_PASSWORD = 'admin.dot';

interface Props {
  appState: AppState;
  setAppState: (updater: (prev: AppState) => AppState) => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

type AdminTab = 'members' | 'categories' | 'entries';

export default function AdminScreen({ appState, setAppState }: Props) {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('members');

  // Member form
  const [memberName, setMemberName] = useState('');
  const [memberSalary, setMemberSalary] = useState('');
  const [memberError, setMemberError] = useState('');
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Category form
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Entry edit
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return toMonthKey(now.getFullYear(), now.getMonth() + 1);
  });
  const [editingHours, setEditingHours] = useState<Record<string, Record<string, string>>>({});
  const [entrySaved, setEntrySaved] = useState(false);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('パスワードが違います。');
    }
  }

  // --- Member operations ---
  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setMemberError('');
    const name = memberName.trim();
    const salary = parseInt(memberSalary, 10);
    if (!name) { setMemberError('名前を入力してください。'); return; }
    if (isNaN(salary) || salary < 0) { setMemberError('月給を正しく入力してください。'); return; }
    if (appState.members.length >= 10 && !editingMember) {
      setMemberError('メンバーは最大10名です。');
      return;
    }
    setAppState((prev) => {
      if (editingMember) {
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === editingMember.id ? { ...m, name, monthlySalary: salary } : m,
          ),
        };
      }
      return {
        ...prev,
        members: [...prev.members, { id: generateId(), name, monthlySalary: salary }],
      };
    });
    setMemberName('');
    setMemberSalary('');
    setEditingMember(null);
  }

  function handleEditMember(m: Member) {
    setEditingMember(m);
    setMemberName(m.name);
    setMemberSalary(String(m.monthlySalary));
    setMemberError('');
  }

  function handleDeleteMember(id: string) {
    setAppState((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== id) }));
    if (editingMember?.id === id) { setEditingMember(null); setMemberName(''); setMemberSalary(''); }
  }

  // --- Category operations ---
  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setCategoryError('');
    const name = categoryName.trim();
    if (!name) { setCategoryError('カテゴリ名を入力してください。'); return; }
    setAppState((prev) => {
      if (editingCategory) {
        return { ...prev, categories: prev.categories.map((c) => c.id === editingCategory.id ? { ...c, name } : c) };
      }
      return { ...prev, categories: [...prev.categories, { id: generateId(), name }] };
    });
    setCategoryName('');
    setEditingCategory(null);
  }

  function handleEditCategory(c: Category) {
    setEditingCategory(c);
    setCategoryName(c.name);
    setCategoryError('');
  }

  function handleDeleteCategory(id: string) {
    setAppState((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== id) }));
    if (editingCategory?.id === id) { setEditingCategory(null); setCategoryName(''); }
  }

  // --- Entry edit operations ---
  const availableMonths = useMemo(() => {
    const keys = Object.keys(appState.monthlyData);
    if (keys.length === 0) {
      const now = new Date();
      return [toMonthKey(now.getFullYear(), now.getMonth() + 1)];
    }
    return [...keys].sort();
  }, [appState.monthlyData]);

  const monthData = appState.monthlyData[selectedMonth] ?? {};

  function getEditHour(memberId: string, catId: string): string {
    if (editingHours[memberId]?.[catId] !== undefined) {
      return editingHours[memberId][catId];
    }
    const val = monthData[memberId]?.[catId] ?? 0;
    return val === 0 ? '' : String(Math.round(val * 100) / 100);
  }

  function handleHourEdit(memberId: string, catId: string, value: string) {
    setEditingHours((prev) => ({
      ...prev,
      [memberId]: { ...(prev[memberId] ?? {}), [catId]: value },
    }));
    setEntrySaved(false);
  }

  function handleSaveEntries() {
    setAppState((prev) => {
      const newMonthlyData: MonthlyData = JSON.parse(JSON.stringify(prev.monthlyData));
      if (!newMonthlyData[selectedMonth]) newMonthlyData[selectedMonth] = {};

      for (const [memberId, catMap] of Object.entries(editingHours)) {
        if (!newMonthlyData[selectedMonth][memberId]) {
          newMonthlyData[selectedMonth][memberId] = {};
        }
        for (const [catId, valStr] of Object.entries(catMap)) {
          const val = parseFloat(valStr);
          newMonthlyData[selectedMonth][memberId][catId] = isNaN(val) ? 0 : val;
        }
      }

      return { ...prev, monthlyData: newMonthlyData };
    });
    setEditingHours({});
    setEntrySaved(true);
    setTimeout(() => setEntrySaved(false), 2000);
  }

  /**
   * 週エントリを削除し、monthlyDataから該当分を差し引く
   */
  function handleDeleteWeekEntry(entryId: string) {
    const entry = appState.weekEntries.find((e) => e.id === entryId);
    if (!entry) return;

    setAppState((prev) => {
      const splits = splitWeekByMonth(parseDate(entry.weekStart), parseDate(entry.weekEnd));
      const newMonthlyData: MonthlyData = JSON.parse(JSON.stringify(prev.monthlyData));

      for (const { monthKey, ratio } of splits) {
        if (!newMonthlyData[monthKey]?.[entry.memberId]) continue;
        for (const [catId, hours] of Object.entries(entry.hours)) {
          const cur = newMonthlyData[monthKey][entry.memberId][catId] ?? 0;
          newMonthlyData[monthKey][entry.memberId][catId] = Math.max(0, cur - hours * ratio);
        }
      }

      return {
        ...prev,
        weekEntries: prev.weekEntries.filter((e) => e.id !== entryId),
        monthlyData: newMonthlyData,
      };
    });
  }

  // 週エントリを月でフィルタ
  const weekEntriesForMonth = useMemo(() => {
    const { year, month } = parseMonthKey(selectedMonth);
    return appState.weekEntries.filter((e) => {
      const s = parseDate(e.weekStart);
      const en = parseDate(e.weekEnd);
      // 週が選択月に重なるもの
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      return s <= monthEnd && en >= monthStart;
    });
  }, [appState.weekEntries, selectedMonth]);

  // パスワード画面
  if (!authenticated) {
    return (
      <div className="flex justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 w-full max-w-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-5 text-center">管理者ログイン</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors">
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'members', label: 'メンバー' },
    { id: 'categories', label: 'カテゴリ' },
    { id: 'entries', label: '入力データ編集' },
  ];

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="bg-white rounded-xl shadow-sm flex overflow-hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* メンバー管理 */}
      {activeTab === 'members' && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">メンバー管理</h2>
            <span className="text-xs text-gray-400">{appState.members.length} / 10名</span>
          </div>
          <div className="p-4 space-y-3">
            <form onSubmit={handleAddMember} className="flex gap-2 flex-wrap">
              <input
                type="text" placeholder="名前" value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number" placeholder="月給（円）" value={memberSalary} min="0"
                onChange={(e) => setMemberSalary(e.target.value)}
                className="w-36 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                {editingMember ? '更新' : '追加'}
              </button>
              {editingMember && (
                <button type="button" onClick={() => { setEditingMember(null); setMemberName(''); setMemberSalary(''); }}
                  className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm">
                  キャンセル
                </button>
              )}
            </form>
            {memberError && <p className="text-sm text-red-600">{memberError}</p>}
            {appState.members.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">まだメンバーがいません。</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {appState.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1 text-sm font-medium text-gray-800">{m.name}</span>
                    <span className="text-sm text-gray-500">¥{m.monthlySalary.toLocaleString('ja-JP')}/月</span>
                    <button onClick={() => handleEditMember(m)} className="text-xs text-blue-600 hover:underline">編集</button>
                    <button onClick={() => handleDeleteMember(m.id)} className="text-xs text-red-500 hover:underline">削除</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* カテゴリ管理 */}
      {activeTab === 'categories' && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">業務カテゴリ管理</h2>
          </div>
          <div className="p-4 space-y-3">
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text" placeholder="カテゴリ名" value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                {editingCategory ? '更新' : '追加'}
              </button>
              {editingCategory && (
                <button type="button" onClick={() => { setEditingCategory(null); setCategoryName(''); }}
                  className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm">
                  キャンセル
                </button>
              )}
            </form>
            {categoryError && <p className="text-sm text-red-600">{categoryError}</p>}
            {appState.categories.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">まだカテゴリがありません。</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {appState.categories.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1 text-sm font-medium text-gray-800">{c.name}</span>
                    <button onClick={() => handleEditCategory(c)} className="text-xs text-blue-600 hover:underline">編集</button>
                    <button onClick={() => handleDeleteCategory(c.id)} className="text-xs text-red-500 hover:underline">削除</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* 入力データ編集 */}
      {activeTab === 'entries' && (
        <div className="space-y-4">
          {/* 月選択 */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 shrink-0">対象月</label>
            <select
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setEditingHours({}); }}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableMonths.map((mk) => {
                const { year, month } = parseMonthKey(mk);
                return <option key={mk} value={mk}>{formatMonthLabel(year, month)}</option>;
              })}
            </select>
          </div>

          {/* メンバー×カテゴリの月次時間を直接編集 */}
          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">月次時間の直接編集</h2>
              <p className="text-xs text-gray-400 mt-0.5">月またぎ按分後の実数値を直接変更します</p>
            </div>
            {appState.members.length === 0 || appState.categories.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">メンバーとカテゴリを登録してください。</p>
            ) : (
              <div className="p-4 space-y-4">
                {appState.members.map((member) => (
                  <div key={member.id}>
                    <p className="text-sm font-semibold text-gray-700 mb-2">{member.name}</p>
                    <div className="space-y-1.5 pl-2">
                      {appState.categories.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-3">
                          <label className="flex-1 text-sm text-gray-600">{cat.name}</label>
                          <input
                            type="number" min="0" step="0.1"
                            value={getEditHour(member.id, cat.id)}
                            onChange={(e) => handleHourEdit(member.id, cat.id, e.target.value)}
                            placeholder="0"
                            className="w-24 border border-gray-300 rounded-lg px-3 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-400 w-4">h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveEntries}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    保存
                  </button>
                  {entrySaved && <span className="text-sm text-green-600">✓ 保存しました</span>}
                </div>
              </div>
            )}
          </section>

          {/* 週エントリ一覧・削除 */}
          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">週次送信履歴</h2>
              <p className="text-xs text-gray-400 mt-0.5">削除すると月次データから自動で差し引かれます</p>
            </div>
            {weekEntriesForMonth.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">この月の送信履歴はありません。</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {weekEntriesForMonth.map((entry) => {
                  const member = appState.members.find((m) => m.id === entry.memberId);
                  return (
                    <li key={entry.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {member?.name ?? '不明'}{' '}
                            <span className="font-normal text-gray-500 text-xs">
                              {entry.weekStart} 〜 {entry.weekEnd}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {appState.categories.map((cat) => {
                              const h = entry.hours[cat.id];
                              if (!h) return null;
                              return (
                                <span key={cat.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                  {cat.name}: {h}h
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteWeekEntry(entry.id)}
                          className="text-xs text-red-500 hover:underline shrink-0 mt-0.5"
                        >
                          削除
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="text-right">
        <button onClick={() => setAuthenticated(false)} className="text-xs text-gray-400 hover:text-gray-600 underline">
          ログアウト
        </button>
      </div>
    </div>
  );
}
