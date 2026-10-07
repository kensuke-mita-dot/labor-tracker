import { useState, useMemo } from 'react';
import { AppState, WeekEntry } from '../types';
import { getLastWeekPeriod, toDateString, formatWeekRange, formatDate } from '../utils/dateUtils';
import { buildCategoryGroups, getLeafCategories } from '../utils/categoryUtils';
import { formatHours } from '../utils/calcUtils';

interface Props {
  appState: AppState;
  onSubmit: (entry: Omit<WeekEntry, 'id' | 'submittedAt'>) => void;
  onUpdate: (entryId: string, changes: Pick<WeekEntry, 'workDays' | 'hours'>) => void;
}

export default function InputScreen({ appState, onSubmit, onUpdate }: Props) {
  const { members, categories, weekEntries } = appState;

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [workDays, setWorkDays] = useState('');
  const [hours, setHours] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<'' | 'created' | 'updated'>('');
  const [error, setError] = useState('');

  const { start: weekStart, end: weekEnd } = useMemo(
    () => getLastWeekPeriod(new Date()),
    [],
  );
  const weekStartStr = toDateString(weekStart);
  const weekEndStr = toDateString(weekEnd);
  // 先週分は今週の日曜日まで入力・修正できる
  const editDeadline = useMemo(() => {
    const d = new Date(weekEnd);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekEnd]);

  const categoryGroups = useMemo(() => buildCategoryGroups(categories), [categories]);
  const leafCategories = useMemo(() => getLeafCategories(categories), [categories]);

  function findExistingEntry(memberId: string): WeekEntry | undefined {
    if (!memberId) return undefined;
    return weekEntries.find((e) => e.memberId === memberId && e.weekStart === weekStartStr);
  }

  const existingEntry = findExistingEntry(selectedMemberId);

  /** 名前を選んだとき、送信済みならその内容をフォームに読み込む */
  function handleMemberChange(memberId: string) {
    setSelectedMemberId(memberId);
    setError('');
    const entry = findExistingEntry(memberId);
    if (entry) {
      setWorkDays(entry.workDays !== undefined ? String(entry.workDays) : '');
      const loaded: Record<string, string> = {};
      for (const [catId, h] of Object.entries(entry.hours)) {
        if (h) loaded[catId] = String(h);
      }
      setHours(loaded);
    } else {
      setWorkDays('');
      setHours({});
    }
  }

  function handleHourChange(catId: string, value: string) {
    setHours((prev) => ({ ...prev, [catId]: value }));
  }

  function hourValue(catId: string): number {
    const val = parseFloat(hours[catId] ?? '');
    return isNaN(val) || val < 0 ? 0 : val;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedMemberId) {
      setError('名前を選択してください。');
      return;
    }
    // ページを開いたまま週をまたいだ場合は、古い週への送信・修正を受け付けない
    if (toDateString(getLastWeekPeriod(new Date()).start) !== weekStartStr) {
      setError('この週の入力期間は終了しました。ページを再読み込みしてください。');
      return;
    }
    const parsedWorkDays = Number(workDays);
    if (workDays.trim() === '' || !Number.isInteger(parsedWorkDays) || parsedWorkDays < 0 || parsedWorkDays > 7) {
      setError('出勤日数を0〜7の整数で入力してください。');
      return;
    }
    if (leafCategories.length === 0) {
      setError('カテゴリが登録されていません。管理者に連絡してください。');
      return;
    }

    const parsedHours: Record<string, number> = {};
    for (const cat of leafCategories) {
      const raw = (hours[cat.id] ?? '').trim();
      const val = raw === '' ? 0 : parseFloat(raw); // 空欄は 0 時間として扱う
      if (isNaN(val) || val < 0) {
        setError(`「${cat.name}」の時間が不正です。`);
        return;
      }
      parsedHours[cat.id] = val;
    }

    const totalH = Object.values(parsedHours).reduce((s, v) => s + v, 0);
    if (totalH === 0) {
      setError('少なくとも1つのカテゴリに時間を入力してください。');
      return;
    }

    if (existingEntry) {
      onUpdate(existingEntry.id, { workDays: parsedWorkDays, hours: parsedHours });
      setSubmitted('updated');
    } else {
      onSubmit({
        memberId: selectedMemberId,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        workDays: parsedWorkDays,
        hours: parsedHours,
      });
      setSubmitted('created');
    }
    setWorkDays('');
    setHours({});
  }

  if (members.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
        メンバーが登録されていません。管理者設定から登録してください。
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-lg font-semibold text-gray-800 mb-1">
          {submitted === 'updated' ? '修正しました' : '送信しました'}
        </p>
        <p className="text-sm text-gray-500">{formatWeekRange(weekStart, weekEnd)}</p>
        <p className="text-xs text-gray-400 mb-6">{formatDate(editDeadline)}まで修正できます</p>
        <button
          onClick={() => { setSubmitted(''); setSelectedMemberId(''); }}
          className="text-blue-600 text-sm underline"
        >
          続けて入力する
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 先週の期間 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-600 font-medium mb-0.5">入力対象週（先週）</p>
        <p className="text-sm font-semibold text-blue-900">{formatWeekRange(weekStart, weekEnd)}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
        {/* 名前選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
          <select
            value={selectedMemberId}
            onChange={(e) => handleMemberChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- 選択してください --</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {existingEntry && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
            この週は送信済みです。{formatDate(editDeadline)}まで内容を修正できます。
          </div>
        )}

        {/* 出勤日数・カテゴリ別時間入力 */}
        {selectedMemberId && leafCategories.length > 0 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">出勤日数</label>
              <div className="flex items-center gap-3">
                <span className="flex-1 text-sm text-gray-700">先週の出勤日数</span>
                <input
                  type="number"
                  min="0"
                  max="7"
                  step="1"
                  value={workDays}
                  onChange={(e) => setWorkDays(e.target.value)}
                  placeholder="0"
                  className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500 w-6">日</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">カテゴリ別時間（時間）</p>
              <div className="space-y-3">
                {categoryGroups.map(({ category, children }) => {
                  if (children.length === 0) {
                    // 単独カテゴリ
                    return (
                      <div
                        key={category.id}
                        className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2"
                      >
                        <label className="flex-1 text-sm font-bold text-blue-900">{category.name}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={hours[category.id] ?? ''}
                          onChange={(e) => handleHourChange(category.id, e.target.value)}
                          placeholder="0"
                          className="w-24 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500 w-6">h</span>
                      </div>
                    );
                  }
                  const subtotal = children.reduce((sum, c) => sum + hourValue(c.id), 0);
                  return (
                    <div key={category.id} className="border border-blue-100 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-3 bg-blue-50 px-3 py-2">
                        <span className="flex-1 text-sm font-bold text-blue-900">{category.name}</span>
                        <span className="text-sm font-bold text-blue-900">
                          合計 {formatHours(subtotal)}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {children.map((cat) => (
                          <div key={cat.id} className="flex items-center gap-3 pl-6 pr-3 py-1.5">
                            <label className="flex-1 text-sm text-gray-700">{cat.name}</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={hours[cat.id] ?? ''}
                              onChange={(e) => handleHourChange(cat.id, e.target.value)}
                              placeholder="0"
                              className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-500 w-6">h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {existingEntry ? '修正して送信' : '送信'}
            </button>
          </form>
        )}

        {selectedMemberId && leafCategories.length === 0 && (
          <p className="text-sm text-gray-500">カテゴリが登録されていません。</p>
        )}
      </div>
    </div>
  );
}
