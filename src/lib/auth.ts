import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  Auth,
  AuthError,
} from 'firebase/auth';

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
