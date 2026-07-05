import { initializeUI } from '@firebase-oss/ui-core';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDx2OpNAD3euXlHS650dQMyA1x9_REw5hg',
  authDomain: 'todo-apps-b462a.firebaseapp.com',
  projectId: 'todo-apps-b462a',
  storageBucket: 'todo-apps-b462a.firebasestorage.app',
  messagingSenderId: '934784967678',
  appId: '1:934784967678:web:7d028912062ade019956af',
  measurementId: 'G-G092W839ZM',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ui = initializeUI({ app, auth });

export { app, auth, db, ui };

