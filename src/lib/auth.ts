import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  Auth,
  AuthError,
} from 'firebase/auth';
import { terminate, clearIndexedDbPersistence, Firestore } from 'firebase/firestore';

export function isMobileOrStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const isMobileUA = /iPhone|iPad|iPod|Android|Mobile|HUAWEI|HarmonyOS|MiuiBrowser|MicroMessenger/i.test(ua);

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari 专属：加到主屏幕后 navigator.standalone === true
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return isMobileUA || isStandalone;
}

const POPUP_FAILURE_CODES = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

export async function signInWithGoogle(auth: Auth): Promise<void> {
  const provider = new GoogleAuthProvider();

  if (isMobileOrStandalone()) {
    await signInWithRedirect(auth, provider);
    return;
  }

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as AuthError)?.code;
    if (code && POPUP_FAILURE_CODES.has(code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function consumeRedirectResult(auth: Auth): Promise<AuthError | null> {
  try {
    await getRedirectResult(auth);
    return null;
  } catch (error) {
    return error as AuthError;
  }
}

/**
 * Sign out + 清空 Firestore 本地缓存 + 整页 reload。
 *
 * 行业惯例（Firebase 官方推荐）：开了持久化（IndexedDB cache）之后，
 * 必须在 sign out 时清掉缓存，否则下个登录到本设备的用户能从 IndexedDB
 * 读到上个用户的数据残留。
 *
 * 调用顺序固定：signOut → terminate → clearIndexedDbPersistence → reload。
 * - terminate 必须在 clearIndexedDbPersistence 之前调用（否则 SDK 报"open connections"）
 * - reload 用 finally 兜底，任何中间步骤失败也会 reload，避免 UI 卡死或数据残留
 */
export async function signOutAndClearCache(
  auth: Auth,
  db: Firestore,
  reload: () => void,
): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // sign out 失败不阻塞清缓存（用户意图是离开，必须强制完成）
  }
  try {
    await terminate(db);
  } catch {
    // terminate 失败不阻塞 clear（继续尝试）
  }
  try {
    await clearIndexedDbPersistence(db);
  } catch {
    // clear 失败可能是浏览器无 IndexedDB / private mode，无影响
  }
  reload();
}
