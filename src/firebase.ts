import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, getDocFromServer, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// 在 Vercel 生产域名下用同源 authDomain，让 /__/auth/* 走反代到 Firebase Auth 后端。
// 这样 signInWithRedirect 整个 OAuth 流转全程同源，绕开 iOS Safari 14+ 的 ITP 第三方 storage 隔离。
// dev / 其他环境保留 firebaseapp.com 域名。
const useSameOriginAuthDomain =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

const resolvedConfig = useSameOriginAuthDomain
  ? { ...firebaseConfig, authDomain: window.location.hostname }
  : firebaseConfig;

export const app = initializeApp(resolvedConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
