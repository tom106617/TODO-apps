import { FirebaseUIProvider, GoogleSignInButton } from '@firebase-oss/ui-react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import '../global.css';
import { auth, ui } from '../lib/firebase';

const GROUPS = [
  { id: 'personal', name: '個人', icon: '👤', color: '#3B82F6' },
  { id: 'work', name: '仕事', icon: '💼', color: '#10B981' },
  { id: 'shopping', name: '買い物', icon: '🛒', color: '#F59E0B' },
];

export default function App() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [todos, setTodos] = useState([
    { id: '1', text: '牛乳と卵を買う', completed: false, group: 'shopping', starred: false },
    { id: '2', text: '週次レポートの提出', completed: true, group: 'work', starred: false },
    { id: '3', text: 'ジムでトレーニング', completed: false, group: 'personal', starred: true },
    { id: '4', text: 'プロジェクトのミーティング', completed: false, group: 'work', starred: true },
  ]);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState('personal');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return unsubscribe;
  }, []);

  const addTodo = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (inputText.trim() === '') return;
    const newTodo = {
      id: Date.now().toString(),
      text: inputText.trim(),
      completed: false,
      group: activeTab,
      starred: false,
    };
    setTodos([newTodo, ...todos]);
    setInputText('');
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const toggleStar = (id: string) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, starred: !todo.starred } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const matchGroup = todo.group === activeTab;
      if (!matchGroup) return false;

      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    });
  }, [todos, activeTab, filter]);

  const progressStats = useMemo(() => {
    const groupTodos = todos.filter((t) => t.group === activeTab);
    const total = groupTodos.length;
    const completed = groupTodos.filter((t) => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }, [todos, activeTab]);

  const activeColor = GROUPS.find((g) => g.id === activeTab)?.color || '#3B82F6';

  const handleSignOut = async () => {
    await auth.signOut();
  };

  return (
    <FirebaseUIProvider ui={ui}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
          <header className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-gray-50">タスク管理</h1>
                <p className="text-sm text-gray-400 mt-1">FirebaseUI でログインして使い始めましょう</p>
              </div>
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                >
                  ログアウト
                </button>
              ) : (
                <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                  未ログイン
                </span>
              )}
            </div>
          </header>

          {!user ? (
            <main className="flex-1 p-6 flex items-center justify-center">
              <div className="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
                <p className="mb-2 text-sm font-semibold text-blue-400">FirebaseUI Auth</p>
                <h2 className="text-xl font-semibold text-gray-50">ログインしてタスクを続ける</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Google アカウントでログインできます。Firebase Console で Google プロバイダを有効化してください。
                </p>
                <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900/70 p-4">
                  <GoogleSignInButton
                    themed
                    onSignIn={(credential) => {
                      setUser(credential.user);
                    }}
                  />
                </div>
              </div>
            </main>
          ) : (
            <>
              <div className="flex border-b border-gray-700 bg-gray-800">
                {GROUPS.map((group) => {
                  const isActive = activeTab === group.id;
                  const uncompletedCount = todos.filter((t) => t.group === group.id && !t.completed).length;
                  return (
                    <button
                      key={group.id}
                      style={isActive ? { borderBottomColor: group.color } : {}}
                      className={`flex-1 flex items-center justify-center py-4 relative border-b-2 transition-all ${isActive ? 'border-b-4 text-white font-bold' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                      onClick={() => setActiveTab(group.id)}
                    >
                      <span className="mr-2 text-lg">{group.icon}</span>
                      <span className="text-sm">{group.name}</span>
                      {uncompletedCount > 0 && (
                        <span
                          style={{ backgroundColor: group.color }}
                          className="absolute top-2 right-4 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow"
                        >
                          {uncompletedCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <main className="flex-1 p-6 flex flex-col max-w-lg mx-auto w-full">
                <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700 shadow-md">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-gray-100 font-semibold text-sm">
                      {GROUPS.find((g) => g.id === activeTab)?.name} の進捗
                    </h2>
                    <span className="text-gray-400 text-xs">
                      {progressStats.completed} / {progressStats.total} 完了 ({progressStats.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${progressStats.percentage}%`, backgroundColor: activeColor }}
                      className="h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="flex space-x-2 mb-4">
                  {['all', 'active', 'completed'].map((f) => {
                    const label = f === 'all' ? 'すべて' : f === 'active' ? '未完了' : '完了済み';
                    const isSelected = filter === f;
                    return (
                      <button
                        key={f}
                        style={isSelected ? { borderColor: activeColor } : {}}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${isSelected ? 'bg-gray-700 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                        onClick={() => setFilter(f)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                  {filteredTodos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <span className="text-3xl mb-2">💡</span>
                      <p className="text-gray-400 font-medium">タスクがありません</p>
                      <p className="text-gray-600 text-xs mt-1">新しいタスクを追加してください！</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTodos.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center bg-gray-800 rounded-xl p-4 border border-gray-700 transition-all hover:border-gray-600"
                        >
                          <button
                            style={item.completed ? { backgroundColor: activeColor, borderColor: activeColor } : {}}
                            className="mr-3 h-5 w-5 rounded-md border-2 border-gray-600 flex items-center justify-center flex-shrink-0 transition-colors"
                            onClick={() => toggleTodo(item.id)}
                          >
                            {item.completed && <span className="text-white text-xs">✓</span>}
                          </button>

                          <div className="flex-1 cursor-pointer pr-2" onClick={() => toggleTodo(item.id)}>
                            <p className={`text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                              {item.text}
                            </p>
                          </div>

                          <button className="p-1 text-lg mr-1 transition-transform active:scale-95" onClick={() => toggleStar(item.id)}>
                            <span className={item.starred ? 'text-yellow-500' : 'text-gray-600'}>★</span>
                          </button>

                          <button className="p-1 text-sm hover:bg-gray-700 rounded transition-colors" onClick={() => deleteTodo(item.id)}>
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </main>

              <footer className="bg-gray-800 border-t border-gray-700 p-4">
                <form onSubmit={addTodo} className="max-w-lg mx-auto flex space-x-3">
                  <input
                    type="text"
                    className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-3 text-sm border border-gray-700 focus:outline-none focus:ring-2"
                    style={{ boxShadow: `0 0 0 2px ${activeColor}` }}
                    placeholder="新しいタスクを入力..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button
                    type="submit"
                    style={{ backgroundColor: activeColor }}
                    className="px-6 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90 active:scale-95"
                  >
                    追加
                  </button>
                </form>
              </footer>
            </>
          )}
        </div>
      </ThemeProvider>
    </FirebaseUIProvider>
  );
}

