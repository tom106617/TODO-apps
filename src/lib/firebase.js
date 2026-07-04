import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// AnalyticsはスマホのWebアプリ（PWA）として使う場合、不要であれば削除しても構いません

// 提供いただいたFirebase設定
const firebaseConfig = {
  apiKey: "AIzaSyDx2OpNAD3euXlHS650dQMyA1x9_REw5hg",
  authDomain: "todo-apps-b462a.firebaseapp.com",
  projectId: "todo-apps-b462a",
  storageBucket: "todo-apps-b462a.firebasestorage.app",
  messagingSenderId: "934784967678",
  appId: "1:934784967678:web:7d028912062ade019956af",
  measurementId: "G-G092W839ZM"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);

// AuthとFirestoreのインスタンスを作成
const auth = getAuth(app);
const db = getFirestore(app);

// 他のファイルで使えるようにエクスポート
export { app, auth, db };
