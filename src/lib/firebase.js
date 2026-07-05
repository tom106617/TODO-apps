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
getRedirectResult(auth)
  .then((result) => {
    // This gives you a Google Access Token. You can use it to access Google APIs.
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;

    // The signed-in user info.
    const user = result.user;
    // IdP data available using getAdditionalUserInfo(result)
    // ...
  }).catch((error) => {
    // Handle Errors here.
    const errorCode = error.code;
    const errorMessage = error.message;
    // The email of the user's account used.
    const email = error.customData.email;
    // The AuthCredential type that was used.
    const credential = GoogleAuthProvider.credentialFromError(error);
    // ...
  });
const db = getFirestore(app);

// 他のファイルで使えるようにエクスポート
export { app, auth, db };
