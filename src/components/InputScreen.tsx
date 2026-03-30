import { useState, useMemo } from 'react';
import { AppState, WeekEntry } from '../types';
import { getLastWeekPeriod, toDateString, formatWeekRange } from '../utils/dateUtils';

interface Props {
  appState: AppState;
  onSubmit: (entry: Omit<WeekEntry, 'id' | 'submittedAt'>) => void;
}

export default function InputScreen({ appState, onSubmit }: Props) {
  const { members, categories, weekEntries } = appState;

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [hours, setHours] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const { start: weekStart, end: weekEnd } = useMemo(
    () => getLastWeekPeriod(new Date()),
    [],
  );
  const weekStartStr = toDateString(weekStart);
  const weekEndStr = toDateString(weekEnd);

  const alreadySubmitted = useMemo(() => {
    if (!selectedMemberId) return false;
    return weekEntries.some(
      (e) => e.memberId === selectedMemberId && e.weekStart === weekStartStr,
    );
  }, [selectedMemberId, weekEntries, weekStartStr]);

  function handleHourChange(catId: string, value: string) {
    setHours((prev) => ({ ...prev, [catId]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedMemberId) {
      setError('名前を選択してください。');
      return;
    }
    if (categories.length === 0) {
      setError('カテゴリが登録されていません。管理者に連絡してください。');
      return;
    }

    const parsedHours: Record<string, number> = {};
    for (const cat of categories) {
      const val = parseFloat(hours[cat.id] ?? '0');
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

    onSubmit({
      memberId: selectedMemberId,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      hours: parsedHours,
    });
    setSubmitted(true);
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
        <p className="text-lg font-semibold text-gray-800 mb-1">送信しました</p>
        <p className="text-sm text-gray-500 mb-6">{formatWeekRange(weekStart, weekEnd)}</p>
        <button
          onClick={() => { setSubmitted(false); setSelectedMemberId(''); }}
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
            onChange={(e) => { setSelectedMemberId(e.target.value); setError(''); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- 選択してください --</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {alreadySubmitted && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
            この週はすでに送信済みです。
          </div>
        )}

        {/* カテゴリ別時間入力 */}
        {selectedMemberId && !alreadySubmitted && categories.length > 0 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">カテゴリ別時間（時間）</p>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3">
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

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              送信
            </button>
          </form>
        )}

        {selectedMemberId && !alreadySubmitted && categories.length === 0 && (
          <p className="text-sm text-gray-500">カテゴリが登録されていません。</p>
        )}
      </div>
    </div>
  );
}
