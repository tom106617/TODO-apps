import { FirebaseUIProvider, GoogleLogo } from '@firebase-oss/ui-react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import '../global.css';
import { auth, db, ui } from '../lib/firebase';

interface TabItem {
  id: string;      // FirestoreのTODOを保存するコレクション名として使います
  name: string;    // 画面に表示するタブ名（後から変更可能）
  icon: string;
  color: string;
  index: number;
}

interface TodoItem {
  id: string;
  title: string;
  isCompleted: boolean;
  index: number;
  assignedTo?: string[];
  createdAt?: any;
  createdBy?: string;
  description?: string;
  updatedAt?: any;
}

export default function App() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // 動的管理するタブ（グループ）のステート
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');

  // 各タブのTodoリストを保持するマップ型ステート { [tabId]: TodoItem[] }
  const [allTodos, setAllTodos] = useState<{ [key: string]: TodoItem[] }>({});
  const [inputText, setInputText] = useState('');

  // タブ編集・追加用のモーダル/入力用ステート
  const [isTabModalOpen, setIsTabModalOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<TabItem | null>(null); // nullなら新規追加
  const [tabInputName, setTabInputName] = useState('');
  const [tabInputIcon, setTabInputIcon] = useState('📝');
  const [tabInputColor, setTabInputColor] = useState('#3B82F6');

  // ✨ タスクのインライン編集用のステート
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTodoText, setEditTodoText] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // 1. タブ（カテゴリー）一覧をFirestoreからリアルタイム取得
  useEffect(() => {
    if (isLoading || !user) {
      setTabs([]);
      return;
    }

    const q = query(collection(db, 'app_tabs'), orderBy('index', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tabList: TabItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        tabList.push({
          id: docSnap.id,
          name: data.name || '',
          icon: data.icon || '📝',
          color: data.color || '#3B82F6',
          index: data.index ?? 0,
        });
      });

      if (tabList.length > 0) {
        setTabs(tabList);
        setActiveTab((prev) => {
          if (!prev || !tabList.some((t) => t.id === prev)) {
            return tabList[0].id;
          }
          return prev;
        });
      } else {
        createDefaultTabs();
      }
    });

    return unsubscribe;
  }, [user, isLoading]);

  // 初期タブがない場合に自動作成する関数
  const createDefaultTabs = async () => {
    const defaults = [
      { name: 'スーパー', icon: '🥦', color: '#10B981', index: 0 },
      { name: 'ドラッグストア', icon: '💊', color: '#EF4444', index: 1 },
      { name: '100均', icon: '🪙', color: '#F59E0B', index: 2 },
      { name: 'その他', icon: '📦', color: '#6B7280', index: 3 },
    ];
    for (const item of defaults) {
      await addDoc(collection(db, 'app_tabs'), item);
    }
  };

  // 2. 全てのタブのTodoを並列で監視して件数をリアルタイム追跡
  useEffect(() => {
    if (isLoading || !user || tabs.length === 0) {
      setAllTodos({});
      return;
    }

    const unsubscribes = tabs.map((tab) => {
      const q = query(collection(db, tab.id), orderBy('index', 'asc'));
      return onSnapshot(q, (snapshot) => {
        const list: TodoItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            title: data.title || '',
            isCompleted: data.isCompleted ?? false,
            index: data.index ?? 0,
            assignedTo: data.assignedTo,
            createdBy: data.createdBy,
            description: data.description,
          });
        });
        setAllTodos((prev) => ({ ...prev, [tab.id]: list }));
      });
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [user, tabs, isLoading]);

  // 現在の選択中タブのTodoを取得
  const currentTodos = allTodos[activeTab] || [];

  const addTodo = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (inputText.trim() === '' || !user || !activeTab) return;

    const nextIndex = currentTodos.length > 0
      ? Math.max(...currentTodos.map(t => t.index)) + 1
      : 0;

    try {
      await addDoc(collection(db, activeTab), {
        title: inputText.trim(),
        isCompleted: false,
        index: nextIndex,
        assignedTo: [user.displayName || 'User'],
        createdAt: new Date(),
        createdBy: user.displayName || 'User',
        description: '',
        updatedAt: new Date()
      });
      setInputText('');
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  };

  const deleteTodoFromDB = async (id: string) => {
    try {
      await deleteDoc(doc(db, activeTab, id));
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  // ✨ タスクの修正を保存する関数
  const saveEditTodo = async (id: string) => {
    if (!editTodoText.trim()) {
      setEditingTodoId(null);
      return;
    }
    try {
      await updateDoc(doc(db, activeTab, id), {
        title: editTodoText.trim(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error updating document: ", error);
    }
    setEditingTodoId(null);
  };

  // 🔄 ドラッグ＆ドロップの共通イベントハンドラー
  const handleOnDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    // A. タブの並び替え処理
    if (result.type === 'TABS') {
      const items = Array.from(tabs);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      const updatedTabs = items.map((item, idx) => ({
        ...item,
        index: idx,
      }));

      // ローカルステートを即時更新
      setTabs(updatedTabs);

      try {
        const batch = writeBatch(db);
        updatedTabs.forEach((item) => {
          const docRef = doc(db, 'app_tabs', item.id);
          batch.update(docRef, { index: item.index });
        });
        await batch.commit();
      } catch (error) {
        console.error("Error updating tab indexes: ", error);
      }
      return;
    }

    // B. タスク(TODO)の並び替え処理 (従来の処理)
    if (result.type === 'TODOS' && activeTab) {
      const items = Array.from(currentTodos);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      const updatedTodos = items.map((item, idx) => ({
        ...item,
        index: idx,
      }));

      setAllTodos((prev) => ({ ...prev, [activeTab]: updatedTodos }));

      try {
        const batch = writeBatch(db);
        updatedTodos.forEach((item) => {
          const docRef = doc(db, activeTab, item.id);
          batch.update(docRef, { index: item.index, updatedAt: new Date() });
        });
        await batch.commit();
      } catch (error) {
        console.error("Error updating batch indexes: ", error);
      }
    }
  };

  // タブの追加または編集の保存処理
  const handleSaveTab = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✨ 名前もアイコンも両方空の場合は保存せずリターン
    if (!user || (!tabInputName.trim() && !tabInputIcon.trim())) {
      alert("タブの名前かアイコンのどちらかを入力してください。");
      return;
    }

    if (editingTab) {
      try {
        await updateDoc(doc(db, 'app_tabs', editingTab.id), {
          name: tabInputName.trim(),
          icon: tabInputIcon.trim(), // ✨ 前後の空白を削除
          color: tabInputColor,
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      const nextTabIndex = tabs.length > 0 ? Math.max(...tabs.map(t => t.index)) + 1 : 0;
      try {
        await addDoc(collection(db, 'app_tabs'), {
          name: tabInputName.trim(),
          icon: tabInputIcon.trim(), // ✨ 前後の空白を削除
          color: tabInputColor,
          index: nextTabIndex,
        });
      } catch (e) {
        console.error(e);
      }
    }
    setIsTabModalOpen(false);
  };

  // タブの削除処理
  const handleDeleteTab = async (tabId: string) => {
    if (tabs.length <= 1) {
      alert("これ以上タブを削除できません。");
      return;
    }
    if (!confirm("このタブ（お買い物リスト）を削除しますか？\n中のタスクは表示されなくなります。")) return;

    try {
      await deleteDoc(doc(db, 'app_tabs', tabId));
      setIsTabModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const openAddTabModal = () => {
    setEditingTab(null);
    setTabInputName('');
    setTabInputIcon('🛒');
    setTabInputColor('#3B82F6');
    setIsTabModalOpen(true);
  };

  const openEditTabModal = (tab: TabItem) => {
    setEditingTab(tab);
    setTabInputName(tab.name);
    setTabInputIcon(tab.icon);
    setTabInputColor(tab.color);
    setIsTabModalOpen(true);
  };

  const activeColor = tabs.find((g) => g.id === activeTab)?.color || '#3B82F6';

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ログインに失敗しました';
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await auth.signOut();
  };

  // ✨ タイトル表示用のステートを追加
  const [showTitle, setShowTitle] = useState(true);

  // ✨ アプリ起動から3秒（3000ミリ秒）後にタイトルを非表示にする
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTitle(false);
    }, 1000); // 1000 = 1秒。もっと早く消したい場合は数値を減らしてください
    return () => clearTimeout(timer);
  }, []);

  return (
    <FirebaseUIProvider ui={ui}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {/* ✨ min-h-screen を h-screen と overflow-hidden に変更し画面高さを固定 */}
        <div className="h-screen bg-gray-900 text-gray-100 flex flex-col font-sans relative overflow-hidden">

          <header
            className={`z-10 shrink-0 overflow-hidden transition-all duration-700 ease-in-out ${showTitle
              ? 'max-h-32 opacity-100 px-6 pt-6 pb-4'
              : 'max-h-0 opacity-0 px-6 pt-0 pb-0'
              }`}
          >
            <h1 className="text-3xl font-black tracking-tight text-white">ToMin TODO</h1>
            <p className="text-sm text-gray-400 mt-1">二人の買い出しシェアリスト</p>
          </header>

          {isLoading ? (
            <main className="flex-1 flex flex-col items-center justify-center">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <span className="text-3xl">⏳</span>
                <p className="text-lg text-gray-400 font-bold tracking-wider">Loading...</p>
              </div>
            </main>
          ) : !user ? (
            <main className="relative flex-1 p-6 flex items-center justify-center overflow-hidden">
              <div className="relative w-full max-w-md bg-white border-4 border-neutral-800 rounded-[32px] p-8 flex flex-col items-center shadow-[0_16px_0_0_rgba(0,0,0,0.3)] z-10">
                <h2 className="text-2xl font-black text-neutral-800 text-center mb-3">ログイン</h2>
                <p className="text-sm text-neutral-500 text-center mb-6 font-medium">
                  Google アカウントを使って安全にログインできます。
                </p>
                <div className="w-full mb-4">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSigningIn}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border-4 border-neutral-800 bg-white px-4 py-3 text-base font-bold text-neutral-800 shadow-[0_6px_0_0_#262626] transition-all hover:-translate-y-0.5 disabled:opacity-70"
                  >
                    <span className="text-xl"><GoogleLogo /></span>
                    <span>{isSigningIn ? 'ログイン中...' : 'Googleでログイン'}</span>
                  </button>
                </div>
                {authError && <p className="text-sm text-red-600">{authError}</p>}
              </div>
            </main>
          ) : (
            // 全体を一つのDragDropContextで囲み、typeで区別します
            <DragDropContext onDragEnd={handleOnDragEnd}>

              {/* 🔄 タブコレクション切り替えタブバー（均等配置＆並び替え対応） */}
              <Droppable droppableId="tabs-bar" direction="horizontal" type="TABS">
                {(provided: any) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    // ✨ flex と w-full を使って領域一杯に広げ、flex-1で各タブを均等に引き伸ばします
                    className="flex w-full border-b border-gray-700 bg-gray-800 overflow-x-auto scrollbar-none shrink-0"
                  >
                    {tabs.map((group, index) => {
                      const isActive = activeTab === group.id;
                      const count = allTodos[group.id]?.length || 0;
                      return (
                        <Draggable key={group.id} draggableId={group.id} index={index}>
                          {(dragProvided: any, snapshot: any) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              style={{
                                ...dragProvided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.8 : 1,
                              }}
                              // ✨ flex-1 を復活させ、さらに min-w-0 を入れることで均等配置しつつ縮小崩れを防ぎます
                              className="flex-1 min-w-0 shrink-0 relative flex items-center justify-center select-none"
                            >
                              <div
                                style={isActive ? { borderBottomColor: group.color } : {}}
                                className={`w-full flex items-center justify-center py-3 px-1 relative border-b-2 transition-colors cursor-pointer ${isActive ? 'border-b-4 text-white font-bold' : 'border-transparent text-gray-400'}`}
                                onClick={() => setActiveTab(group.id)}
                                onDoubleClick={() => openEditTabModal(group)}
                              >
                                <div className="flex items-center justify-center min-w-0">
                                  {group.icon && (
                                    <span className={`text-base flex items-center shrink-0 ${group.name ? 'mr-1' : ''}`}>
                                      {group.icon}
                                    </span>
                                  )}

                                  {group.name ? (
                                    <span className="text-xs sm:text-sm truncate leading-none">{group.name}</span>
                                  ) : null}

                                  {count > 0 && (
                                    <span
                                      style={{ backgroundColor: group.color }}
                                      className={`shrink-0 ${(group.icon || group.name) ? 'ml-1.5' : ''} text-[10px] text-white px-1.5 rounded-full font-bold min-w-[18px] h-[18px] inline-flex items-center justify-center leading-none`}
                                    >
                                      {count}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditTabModal(group);
                                }}
                                className="absolute right-0.5 top-1 text-[10px] text-gray-600 hover:text-gray-400 opacity-50 hover:opacity-100 p-1"
                              >
                                ⚙️
                              </button>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}

                    {/* タブ追加ボタン */}
                    <button
                      onClick={openAddTabModal}
                      className="px-3 py-3 text-gray-400 hover:text-white text-xl font-bold border-b-2 border-transparent transition-colors flex items-center justify-center shrink-0"
                      title="タブを追加"
                    >
                      ➕
                    </button>
                  </div>
                )}
              </Droppable>

              {/* タスク一覧表示メインエリア ✨ min-h-0 を追加してスクロール領域を確立 */}
              <main className="flex-1 flex flex-col max-w-lg mx-auto w-full min-h-0">
                <Droppable droppableId="todos-list" type="TODOS">
                  {(provided: any) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="flex-1 overflow-y-auto pr-1 space-y-2 p-4"
                    >
                      {currentTodos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <span className="text-3xl mb-2">💡</span>
                          <p className="text-gray-400 font-medium">タスクがありません</p>
                        </div>
                      ) : (
                        currentTodos.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided: any, snapshot: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  backgroundColor: snapshot.isDragging ? '#374151' : '#1F2937'
                                }}
                                className="flex items-center bg-gray-800 rounded-xl p-4 border border-gray-700 transition-all hover:border-gray-600 select-none"
                              >
                                <button
                                  className="mr-3 h-5 w-5 rounded-md border-2 border-gray-600 flex items-center justify-center flex-shrink-0 transition-colors hover:bg-red-500/20"
                                  onClick={() => deleteTodoFromDB(item.id)}
                                  title="完了（削除）"
                                >
                                  <span className="text-transparent hover:text-white text-xs">✓</span>
                                </button>

                                {/* ✨ テキストクリックで編集モードに切り替え */}
                                <div
                                  className="flex-1 pr-2 cursor-pointer"
                                  onClick={() => {
                                    if (editingTodoId !== item.id) {
                                      setEditingTodoId(item.id);
                                      setEditTodoText(item.title);
                                    }
                                  }}
                                >
                                  {editingTodoId === item.id ? (
                                    <input
                                      type="text"
                                      autoFocus
                                      className="w-full bg-gray-700 text-white border border-gray-500 rounded px-2 py-1 text-base focus:outline-none focus:border-blue-500"
                                      value={editTodoText}
                                      onChange={(e) => setEditTodoText(e.target.value)}
                                      onBlur={() => saveEditTodo(item.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEditTodo(item.id);
                                        if (e.key === 'Escape') setEditingTodoId(null);
                                      }}
                                    />
                                  ) : (
                                    <>
                                      <p className="text-base text-gray-200 font-medium">
                                        {item.title}
                                      </p>
                                      {item.description ? (
                                        <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </main>

              <footer className="bg-gray-800 border-t border-gray-700 px-4 pt-4 pb-10 shrink-0">
                <form onSubmit={addTodo} className="max-w-lg mx-auto flex space-x-3">
                  <input
                    type="text"
                    className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-3 text-lg border border-gray-700 focus:outline-none focus:ring-2"
                    style={{
                      boxShadow: `0 0 0 2px ${activeColor} `,
                      fontSize: '18px'
                    }}
                    placeholder="新しいタスクを入力..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button
                    type="submit"
                    style={{ backgroundColor: activeColor }}
                    className="px-6 rounded-lg text-white font-semibold text-base transition-opacity hover:opacity-90 active:scale-95"
                  >
                    追加
                  </button>
                </form>
              </footer>

              {/* タブ追加・編集モーダル */}
              {isTabModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <form onSubmit={handleSaveTab} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
                    <h3 className="text-xl font-bold text-white">
                      {editingTab ? 'タブの設定を変更' : '新しいタブを追加'}
                    </h3>

                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 font-bold">タブの名前 (任意)</label>
                      <input
                        type="text"
                        maxLength={12}
                        className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg p-2.5 focus:outline-none"
                        placeholder="例: カルディ, ホームセンター"
                        value={tabInputName}
                        onChange={(e) => setTabInputName(e.target.value)}
                      // ✨ required を削除しました
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 font-bold">アイコン (絵文字)</label>
                        <input
                          type="text"
                          className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg p-2.5 text-center text-lg"
                          value={tabInputIcon}
                          onChange={(e) => setTabInputIcon(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 font-bold">テーマカラー</label>
                        <input
                          type="color"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg h-[46px] p-1 cursor-pointer"
                          value={tabInputColor}
                          onChange={(e) => setTabInputColor(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsTabModalOpen(false)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-medium text-sm transition-colors"
                      >
                        キャンセル
                      </button>

                      {editingTab && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTab(editingTab.id)}
                          className="px-3 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/40 py-2 rounded-lg font-medium text-sm transition-all"
                          title="このタブを削除"
                        >
                          🗑️
                        </button>
                      )}

                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-sm transition-colors"
                      >
                        保存
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </DragDropContext>
          )}
        </div>
      </ThemeProvider>
    </FirebaseUIProvider >
  );
}
