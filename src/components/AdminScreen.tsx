import { useState } from 'react';
import { AppState, Member, Category } from '../types';

const ADMIN_PASSWORD = 'admin';

interface Props {
  appState: AppState;
  setAppState: (updater: (prev: AppState) => AppState) => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function AdminScreen({ appState, setAppState }: Props) {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Member form
  const [memberName, setMemberName] = useState('');
  const [memberSalary, setMemberSalary] = useState('');
  const [memberError, setMemberError] = useState('');
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Category form
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

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
    if (appState.members.length >= 5 && !editingMember) {
      setMemberError('メンバーは最大5名です。');
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
    setAppState((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== id),
    }));
    if (editingMember?.id === id) {
      setEditingMember(null);
      setMemberName('');
      setMemberSalary('');
    }
  }

  // --- Category operations ---
  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setCategoryError('');
    const name = categoryName.trim();
    if (!name) { setCategoryError('カテゴリ名を入力してください。'); return; }

    setAppState((prev) => {
      if (editingCategory) {
        return {
          ...prev,
          categories: prev.categories.map((c) =>
            c.id === editingCategory.id ? { ...c, name } : c,
          ),
        };
      }
      return {
        ...prev,
        categories: [...prev.categories, { id: generateId(), name }],
      };
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
    setAppState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
    }));
    if (editingCategory?.id === id) {
      setEditingCategory(null);
      setCategoryName('');
    }
  }

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
            {passwordError && (
              <p className="text-sm text-red-600">{passwordError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* メンバー管理 */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">メンバー管理</h2>
          <span className="text-xs text-gray-400">{appState.members.length} / 5名</span>
        </div>

        <div className="p-4 space-y-3">
          {/* フォーム */}
          <form onSubmit={handleAddMember} className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="名前"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="月給（円）"
              value={memberSalary}
              onChange={(e) => setMemberSalary(e.target.value)}
              min="0"
              className="w-36 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {editingMember ? '更新' : '追加'}
            </button>
            {editingMember && (
              <button
                type="button"
                onClick={() => { setEditingMember(null); setMemberName(''); setMemberSalary(''); }}
                className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                キャンセル
              </button>
            )}
          </form>
          {memberError && <p className="text-sm text-red-600">{memberError}</p>}

          {/* 一覧 */}
          {appState.members.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">まだメンバーがいません。</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {appState.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-sm font-medium text-gray-800">{m.name}</span>
                  <span className="text-sm text-gray-500">
                    ¥{m.monthlySalary.toLocaleString('ja-JP')}/月
                  </span>
                  <button
                    onClick={() => handleEditMember(m)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteMember(m.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* カテゴリ管理 */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">業務カテゴリ管理</h2>
        </div>

        <div className="p-4 space-y-3">
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              placeholder="カテゴリ名"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {editingCategory ? '更新' : '追加'}
            </button>
            {editingCategory && (
              <button
                type="button"
                onClick={() => { setEditingCategory(null); setCategoryName(''); }}
                className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
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
                  <button
                    onClick={() => handleEditCategory(c)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="text-right">
        <button
          onClick={() => setAuthenticated(false)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
