import { useState, useCallback } from 'react';
import { AppState, Screen, WeekEntry, MonthlyData } from './types';
import { splitWeekByMonth, parseDate } from './utils/dateUtils';
import Navigation from './components/Navigation';
import InputScreen from './components/InputScreen';
import CheckScreen from './components/CheckScreen';
import AdminScreen from './components/AdminScreen';

const STORAGE_KEY = 'labor-tracker-v1';

const DEFAULT_STATE: AppState = {
  members: [],
  categories: [],
  weekEntries: [],
  monthlyData: {},
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('input');
  const [appState, setAppStateRaw] = useState<AppState>(loadState);

  const setAppState = useCallback((updater: (prev: AppState) => AppState) => {
    setAppStateRaw((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  /** 週エントリを送信し、月またぎ分割して monthlyData に反映 */
  const submitWeekEntry = useCallback(
    (entry: Omit<WeekEntry, 'id' | 'submittedAt'>) => {
      const id = `${entry.memberId}-${entry.weekStart}-${Date.now()}`;
      const submittedAt = new Date().toISOString();
      const newEntry: WeekEntry = { ...entry, id, submittedAt };

      setAppState((prev) => {
        // 月またぎ分割
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
