import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { withTimeout } from './timeout';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// 各步骤超时，确保 UI 不会永远卡在"请求中..."。
// SW 注册较快，给 8s；FCM 订阅可能受网络环境影响，给 15s；Firestore 写入给 10s。
const SW_READY_TIMEOUT_MS = 8000;
const PUSH_SUBSCRIBE_TIMEOUT_MS = 15000;
const FIRESTORE_WRITE_TIMEOUT_MS = 10000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Check if the browser supports Web Push.
 * Works on iOS Safari 16.4+ when launched from home screen.
 */
export function isPushSupported(): boolean {
  return 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

/**
 * Check if we're on iOS but NOT in standalone (home screen) mode.
 * iOS requires PWA to be added to home screen for push to work.
 */
export function isIOSNonStandalone(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  // @ts-expect-error navigator.standalone is iOS-specific
  return navigator.standalone !== true;
}

/**
 * Request notification permission and subscribe via Web Push API.
 * Stores the PushSubscription in Firestore.
 */
export async function requestPermissionAndSubscribe(userId: string): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('UNSUPPORTED');
  if (isIOSNonStandalone()) throw new Error('IOS_NOT_STANDALONE');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(`permission=${permission}`);

  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID_KEY 未配置');

  // Use the PWA service worker (which includes push-handler.js via importScripts)
  // dev 模式下 PWA 默认未启用 / 注册失败时，serviceWorker.ready 会永远挂起，
  // 必须超时降级以避免 UI 卡死。
  const swReg = await withTimeout(
    navigator.serviceWorker.ready,
    SW_READY_TIMEOUT_MS,
    'Service Worker 未就绪',
  );

  let subscription = await swReg.pushManager.getSubscription();
  if (!subscription) {
    // pushManager.subscribe 需要联系浏览器厂商的推送服务（Chrome → FCM 等），
    // 网络受限时可能长时间不返回，必须设置上界。
    subscription = await withTimeout(
      swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }),
      PUSH_SUBSCRIBE_TIMEOUT_MS,
      '订阅推送服务',
    );
  }

  // Store in Firestore — use endpoint hash as doc ID for idempotency
  const subJson = subscription.toJSON();
  const docId = btoa(subscription.endpoint).replace(/[/+=]/g, '_').slice(-80);

  await withTimeout(
    setDoc(doc(db, `users/${userId}/pushSubscriptions/${docId}`), {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    }),
    FIRESTORE_WRITE_TIMEOUT_MS,
    '保存订阅到云端',
  );

  return subscription;
}

/**
 * Remove all push subscriptions from Firestore and unsubscribe.
 */
export async function removeAllSubscriptions(userId: string): Promise<void> {
  const snap = await getDocs(collection(db, `users/${userId}/pushSubscriptions`));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));

  const swReg = await navigator.serviceWorker.ready;
  const sub = await swReg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}
