import { useState, useCallback, useEffect } from 'react';
import { AppState, Screen, WeekEntry, MonthlyData } from './types';
import { splitWeekByMonth, parseDate } from './utils/dateUtils';
import { fetchState, saveState, subscribeState } from './services/firestoreService';
import Navigation from './components/Navigation';
import InputScreen from './components/InputScreen';
import CheckScreen from './components/CheckScreen';
import AdminScreen from './components/AdminScreen';

const DEFAULT_STATE: AppState = {
  members: [],
  categories: [],
  weekEntries: [],
  monthlyData: {},
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('input');
  const [appState, setAppStateLocal] = useState<AppState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 初回ロード & リアルタイム購読
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    fetchState()
      .then((state) => {
        setAppStateLocal(state);
        setLoading(false);
        // リアルタイム同期（他のブラウザからの変更を反映）
        unsubscribe = subscribeState((s) => setAppStateLocal(s));
      })
      .catch((err) => {
        console.error(err);
        const msg = err?.code === 'unavailable'
          ? 'Firestore に接続できません。Firebase コンソールで Firestore Database を作成してください。'
          : `Firebase エラー: ${err?.message ?? err}`;
        setError(msg);
        setLoading(false);
      });

    return () => { unsubscribe?.(); };
  }, []);

  /** 状態を更新して Firestore に保存 */
  const setAppState = useCallback(
    async (updater: (prev: AppState) => AppState) => {
      setAppStateLocal((prev) => {
        const next = updater(prev);
        saveState(next).catch(console.error);
        return next;
      });
    },
    [],
  );

  /** 週エントリを送信し、月またぎ分割して monthlyData に反映 */
  const submitWeekEntry = useCallback(
    (entry: Omit<WeekEntry, 'id' | 'submittedAt'>) => {
      const id = `${entry.memberId}-${entry.weekStart}-${Date.now()}`;
      const submittedAt = new Date().toISOString();
      const newEntry: WeekEntry = { ...entry, id, submittedAt };

      setAppState((prev) => {
        const splits = splitWeekByMonth(
          parseDate(entry.weekStart),
          parseDate(entry.weekEnd),
        );

        const newMonthlyData: MonthlyData = JSON.parse(JSON.stringify(prev.monthlyData));

        for (const { monthKey, ratio } of splits) {
          if (!newMonthlyData[monthKey]) newMonthlyData[monthKey] = {};
          if (!newMonthlyData[monthKey][entry.memberId]) {
            newMonthlyData[monthKey][entry.memberId] = {};
          }
          for (const [catId, hours] of Object.entries(entry.hours)) {
            const prev_h = newMonthlyData[monthKey][entry.memberId][catId] ?? 0;
            newMonthlyData[monthKey][entry.memberId][catId] = prev_h + hours * ratio;
          }
        }

        return {
          ...prev,
          weekEntries: [...prev.weekEntries, newEntry],
          monthlyData: newMonthlyData,
        };
      });
    },
    [setAppState],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-sm text-center">
          <p className="text-red-600 font-medium mb-2">接続エラー</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-gray-800">労働時間トラッカー</h1>
        </div>
      </header>

      <Navigation screen={screen} onChangeScreen={setScreen} />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {screen === 'input' && (
          <InputScreen appState={appState} onSubmit={submitWeekEntry} />
        )}
        {screen === 'check' && (
          <CheckScreen appState={appState} />
        )}
        {screen === 'admin' && (
          <AdminScreen appState={appState} setAppState={setAppState} />
        )}
      </main>
    </div>
  );
}
