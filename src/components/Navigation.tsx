import { Screen } from '../types';

interface Props {
  screen: Screen;
  onChangeScreen: (s: Screen) => void;
}

const TABS: { id: Screen; label: string }[] = [
  { id: 'input', label: '入力' },
  { id: 'check', label: 'チェック' },
  { id: 'admin', label: '管理者設定' },
];

export default function Navigation({ screen, onChangeScreen }: Props) {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 flex">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChangeScreen(tab.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              screen === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
