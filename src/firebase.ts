import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
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

// IndexedDB 持久化缓存：
// - 第二次访问起，onSnapshot 立刻从本地缓存 emit → loaded=true 几乎瞬间触发
// - 后台与服务端同步增量
// - persistentMultipleTabManager 让多个 tab 共享同一份缓存，避免互相覆盖
// - 私有模式 / 旧浏览器无 IndexedDB 时 SDK 自动 fallback 到内存缓存（无负面）
// - 安全：sign out 时必须调 lib/auth.ts::signOutAndClearCache 清掉缓存，
//   否则下一个登录到本设备的用户能从 IndexedDB 读到上个用户的数据残留。
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  firebaseConfig.firestoreDatabaseId,
);
export const auth = getAuth(app);
